import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { chatAPI, socialAPI, userSearchAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import SearchBar from '../../components/common/SearchBar';
import UserRow from '../../components/common/UserRow';
import ModalSheet from '../../components/common/ModalSheet';
import TabBar from '../../components/common/TabBar';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const NEW_MSG_TABS = [
  { key: 'all', label: 'All' },
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
  { key: 'contacts', label: 'Contacts' },
];

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}w`;
}

// ─── Conversation List Item ─────────────────────────────────────────────────
function ConversationRow({ convo, userId, onPress }) {
  const other = convo.participants?.find((p) => p.id !== userId) || {};
  const isUnread = (convo.unread_count || 0) > 0;

  return (
    <TouchableOpacity style={styles.convoRow} onPress={() => onPress(convo, other)} activeOpacity={0.7}>
      <Avatar uri={other.avatar} name={other.name || ''} size={48} />
      <View style={styles.convoInfo}>
        <View style={styles.convoTopRow}>
          <Text style={[styles.convoName, isUnread && styles.convoNameUnread]} numberOfLines={1}>
            {other.name || 'Unknown'}
          </Text>
          <Text style={styles.convoTime}>{formatTimeAgo(convo.last_message_at)}</Text>
        </View>
        <View style={styles.convoBottomRow}>
          <Text
            style={[styles.convoPreview, isUnread && styles.convoPreviewUnread]}
            numberOfLines={1}
          >
            {convo.last_message || 'No messages yet'}
          </Text>
          {isUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {convo.unread_count > 99 ? '99+' : convo.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────
function MessageBubble({ message, isOwn, onLongPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={isOwn ? onLongPress : undefined}
      style={[styles.bubbleWrapper, isOwn ? styles.bubbleWrapperOwn : styles.bubbleWrapperOther]}
    >
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
          {message.content}
        </Text>
        <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>
          {formatTimeAgo(message.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── New Message Modal Content ──────────────────────────────────────────────
function NewMessageContent({ onSelectUser, userId }) {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'followers' && followers.length === 0) {
      setLoading(true);
      socialAPI.getFollowers(userId)
        .then((res) => setFollowers(res.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (activeTab === 'following' && following.length === 0) {
      setLoading(true);
      socialAPI.getFollowing(userId)
        .then((res) => setFollowing(res.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (activeTab === 'contacts' && contacts.length === 0) {
      setLoading(true);
      socialAPI.getSyncedContacts()
        .then((res) => setContacts(res.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [activeTab, userId]);

  useEffect(() => {
    if (activeTab !== 'all') return;
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      userSearchAPI.search(searchQuery)
        .then((res) => setSearchResults(res.data || []))
        .catch(() => setSearchResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const getList = () => {
    switch (activeTab) {
      case 'all': return searchResults;
      case 'followers': return followers;
      case 'following': return following;
      case 'contacts': return contacts;
      default: return [];
    }
  };

  const listData = getList();

  return (
    <View style={{ minHeight: 300 }}>
      <TabBar tabs={NEW_MSG_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'all' && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name..."
          style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.md }}
        />
      )}
      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.centerLoader}>
          <Text style={styles.emptySubtext}>
            {activeTab === 'all' && !searchQuery ? 'Type a name to search' : 'No users found'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id?.toString() || item.user_id?.toString()}
          renderItem={({ item }) => {
            const u = item.user || item;
            return (
              <UserRow
                user={u}
                subtitle={u.sport || u.email || ''}
                onPress={() => onSelectUser(u)}
              />
            );
          }}
          style={{ maxHeight: 300 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

// ─── Active Chat Header ─────────────────────────────────────────────────────
function ChatHeader({ otherUser, onlineStatus, onBack }) {
  return (
    <View style={styles.chatHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.backArrow}>{'<'}</Text>
      </TouchableOpacity>
      <Avatar uri={otherUser.avatar} name={otherUser.name || ''} size={36} />
      <View style={styles.chatHeaderInfo}>
        <Text style={styles.chatHeaderName} numberOfLines={1}>{otherUser.name || 'Unknown'}</Text>
        <View style={styles.onlineRow}>
          <View style={[styles.onlineDot, { backgroundColor: onlineStatus ? '#22c55e' : Colors.mutedForeground }]} />
          <Text style={styles.onlineText}>{onlineStatus ? 'Online' : 'Offline'}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Typing Indicator ───────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <View style={styles.typingRow}>
      <View style={styles.typingDots}>
        <View style={styles.typingDot} />
        <View style={[styles.typingDot, { opacity: 0.6 }]} />
        <View style={[styles.typingDot, { opacity: 0.3 }]} />
      </View>
      <Text style={styles.typingText}>typing...</Text>
    </View>
  );
}

// ─── Main ChatScreen ────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  // Conversation list state
  const [conversations, setConversations] = useState([]);
  const [filteredConvos, setFilteredConvos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMsgVisible, setNewMsgVisible] = useState(false);

  // Active chat state
  const [activeConvo, setActiveConvo] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ── Load conversations ──────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await chatAPI.conversations();
      const convos = res.data || [];
      setConversations(convos);
      if (!searchQuery) {
        setFilteredConvos(convos);
      }
    } catch (err) {
      if (!refreshing) {
        Alert.alert('Error', 'Failed to load conversations');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, refreshing]);

  useEffect(() => {
    loadConversations();
  }, []);

  // Poll conversations every 5 seconds
  useEffect(() => {
    if (activeConvo) return;
    const interval = setInterval(() => {
      chatAPI.conversations()
        .then((res) => {
          const convos = res.data || [];
          setConversations(convos);
          if (!searchQuery) setFilteredConvos(convos);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [activeConvo, searchQuery]);

  // Filter conversations by search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredConvos(conversations);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = conversations.filter((c) => {
      const other = c.participants?.find((p) => p.id !== user?.id);
      return other?.name?.toLowerCase().includes(q);
    });
    setFilteredConvos(filtered);
  }, [searchQuery, conversations, user?.id]);

  // ── Load messages for active convo ──────────────────────────────────────
  const loadMessages = useCallback(async (convoId) => {
    setMsgLoading(true);
    try {
      const res = await chatAPI.getMessages(convoId);
      setMessages(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setMsgLoading(false);
    }
  }, []);

  // Poll messages every 3 seconds when in active chat
  useEffect(() => {
    if (!activeConvo) return;
    const interval = setInterval(() => {
      chatAPI.getMessages(activeConvo.id)
        .then((res) => setMessages(res.data || []))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConvo]);

  // Poll typing status every 3 seconds
  useEffect(() => {
    if (!activeConvo) return;
    const interval = setInterval(() => {
      chatAPI.getTyping(activeConvo.id)
        .then((res) => {
          const typingUsers = res.data || [];
          const otherTyping = typingUsers.some((t) => t.user_id !== user?.id);
          setIsOtherTyping(otherTyping);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConvo, user?.id]);

  // Online heartbeat every 15 seconds
  useEffect(() => {
    chatAPI.heartbeat().catch(() => {});
    const interval = setInterval(() => {
      chatAPI.heartbeat().catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Check other user online status
  useEffect(() => {
    if (!otherUser) return;
    const checkOnline = () => {
      chatAPI.onlineStatus(otherUser.id)
        .then((res) => setOtherOnline(res.data?.online || false))
        .catch(() => {});
    };
    checkOnline();
    const interval = setInterval(checkOnline, 10000);
    return () => clearInterval(interval);
  }, [otherUser]);

  // ── Enter a conversation ────────────────────────────────────────────────
  const enterConvo = (convo, other) => {
    setActiveConvo(convo);
    setOtherUser(other);
    loadMessages(convo.id);
  };

  // ── Start new conversation ──────────────────────────────────────────────
  const handleSelectUser = async (selectedUser) => {
    setNewMsgVisible(false);
    try {
      const res = await chatAPI.startConversation(selectedUser.id);
      const convo = res.data;
      setActiveConvo(convo);
      setOtherUser(selectedUser);
      loadMessages(convo.id);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to start conversation');
    }
  };

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!msgText.trim() || !activeConvo || sending) return;
    const text = msgText.trim();
    setMsgText('');
    setSending(true);
    try {
      await chatAPI.sendMessage(activeConvo.id, { content: text });
      const res = await chatAPI.getMessages(activeConvo.id);
      setMessages(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to send message');
      setMsgText(text);
    } finally {
      setSending(false);
    }
  };

  // ── Handle typing indicator ─────────────────────────────────────────────
  const handleTextChange = (text) => {
    setMsgText(text);
    if (!activeConvo) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    chatAPI.setTyping(activeConvo.id).catch(() => {});
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  // ── Delete message ──────────────────────────────────────────────────────
  const handleDeleteMessage = (message) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatAPI.deleteMessage(activeConvo.id, message.id);
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete message');
          }
        },
      },
    ]);
  };

  // ── Go back to conversation list ────────────────────────────────────────
  const handleBack = () => {
    setActiveConvo(null);
    setOtherUser(null);
    setMessages([]);
    setMsgText('');
    setIsOtherTyping(false);
    loadConversations();
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  // ════════════════════════════════════════════════════════════════════════
  // ACTIVE CHAT VIEW
  // ════════════════════════════════════════════════════════════════════════
  if (activeConvo && otherUser) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ChatHeader otherUser={otherUser} onlineStatus={otherOnline} onBack={handleBack} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {msgLoading ? (
            <View style={styles.centerLoader}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id?.toString()}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isOwn={item.sender_id === user?.id}
                  onLongPress={() => handleDeleteMessage(item)}
                />
              )}
              inverted
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={isOtherTyping ? <TypingIndicator /> : null}
              ListEmptyComponent={
                <View style={styles.emptyChatContainer}>
                  <Text style={styles.emptyChatIcon}>💬</Text>
                  <Text style={styles.emptyChatText}>No messages yet</Text>
                  <Text style={styles.emptyChatSubtext}>
                    Say hello to {otherUser.name || 'your friend'}!
                  </Text>
                </View>
              }
            />
          )}

          <View style={styles.inputBar}>
            <TextInput
              style={styles.msgInput}
              value={msgText}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              placeholderTextColor={Colors.mutedForeground}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!msgText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!msgText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.primaryForeground} />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // CONVERSATION LIST VIEW
  // ════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>YOUR</Text>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
      </View>

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search conversations..."
        style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.md }}
      />

      {/* Conversation List */}
      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredConvos}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <ConversationRow convo={item} userId={user?.id} onPress={enterConvo} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={filteredConvos.length === 0 ? { flex: 1 } : { paddingBottom: Spacing.xl3 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="💬"
              title="No conversations yet"
              subtitle="Start a new message to connect with other players"
              actionLabel="New Message"
              onAction={() => setNewMsgVisible(true)}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setNewMsgVisible(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* New Message Modal */}
      <ModalSheet
        visible={newMsgVisible}
        onClose={() => setNewMsgVisible(false)}
        title="New Message"
      >
        <NewMessageContent onSelectUser={handleSelectUser} userId={user?.id} />
      </ModalSheet>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  headerSub: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: Typography.xl3,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySubtext: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textAlign: 'center',
    marginTop: Spacing.md,
  },

  // ── Conversation List ───────────────────────────────────────────────────
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  convoInfo: {
    flex: 1,
    gap: 4,
  },
  convoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convoName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    flex: 1,
    marginRight: Spacing.sm,
  },
  convoNameUnread: {
    color: Colors.foreground,
    fontFamily: Typography.fontBodyExtraBold,
  },
  convoTime: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  convoBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convoPreview: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    flex: 1,
    marginRight: Spacing.sm,
  },
  convoPreviewUnread: {
    color: Colors.foreground,
    fontFamily: Typography.fontBodyBold,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Spacing.radiusFull,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 10,
    fontFamily: Typography.fontBodyBold,
    color: Colors.primaryForeground,
  },

  // ── FAB ─────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl2,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.primaryForeground,
    lineHeight: 30,
  },

  // ── Active Chat Header ──────────────────────────────────────────────────
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: Spacing.radiusSm,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  chatHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  chatHeaderName: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineText: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },

  // ── Messages ────────────────────────────────────────────────────────────
  messagesContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  bubbleWrapper: {
    marginBottom: Spacing.sm,
    maxWidth: '80%',
  },
  bubbleWrapperOwn: {
    alignSelf: 'flex-end',
  },
  bubbleWrapperOther: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusLg,
  },
  bubbleOwn: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Spacing.xs,
  },
  bubbleOther: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    lineHeight: 20,
  },
  bubbleTextOwn: {
    color: Colors.primaryForeground,
  },
  bubbleTextOther: {
    color: Colors.foreground,
  },
  bubbleTime: {
    fontSize: 9,
    fontFamily: Typography.fontBody,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeOwn: {
    color: 'rgba(8, 14, 29, 0.5)',
  },
  bubbleTimeOther: {
    color: Colors.mutedForeground,
  },
  emptyChatContainer: {
    alignItems: 'center',
    paddingTop: 60,
    transform: [{ scaleY: -1 }],
  },
  emptyChatIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyChatText: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  emptyChatSubtext: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginTop: Spacing.xs,
  },

  // ── Typing Indicator ────────────────────────────────────────────────────
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.mutedForeground,
  },
  typingText: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },

  // ── Input Bar ───────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  msgInput: {
    flex: 1,
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.foreground,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: Spacing.radiusMd,
    height: 40,
    paddingHorizontal: Spacing.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
