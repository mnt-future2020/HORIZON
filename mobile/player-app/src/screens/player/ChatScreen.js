import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, TextInput,
  KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatAPI, socialAPI, userSearchAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useChatWebSocket } from '../../hooks/useChatWebSocket';
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

// ─── Optional native modules (graceful fallback) ────────────────────────────
let ImagePicker = null;
let DocumentPicker = null;
let Audio = null;
try { ImagePicker = require('expo-image-picker'); } catch { /* not installed */ }
try { DocumentPicker = require('expo-document-picker'); } catch { /* not installed */ }
try { Audio = require('expo-av').Audio; } catch { /* not installed */ }

// ─── Constants ───────────────────────────────────────────────────────────────
const NEW_MSG_TABS = [
  { key: 'all', label: 'All' },
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
  { key: 'contacts', label: 'Contacts' },
];

const EMOJI_MAP = {
  thumbsup: '\u{1F44D}',
  heart: '\u2764\uFE0F',
  laugh: '\u{1F602}',
  wow: '\u{1F62E}',
  fire: '\u{1F525}',
  clap: '\u{1F44F}',
};

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

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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

// ─── Voice Message Bubble ───────────────────────────────────────────────────
function VoiceMessageBubble({ mediaUrl, duration, isOwn }) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef(null);

  const handlePlayPause = async () => {
    if (!Audio) return;
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else if (soundRef.current) {
        await soundRef.current.playAsync();
        setPlaying(true);
      } else {
        const { sound } = await Audio.Sound.createAsync(
          { uri: mediaUrl },
          { shouldPlay: true },
        );
        soundRef.current = sound;
        setPlaying(true);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setPlaying(false);
            soundRef.current = null;
          }
        });
      }
    } catch {
      /* playback error */
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  return (
    <TouchableOpacity style={styles.voiceBubble} onPress={handlePlayPause} activeOpacity={0.7}>
      <Ionicons
        name={playing ? 'pause' : 'play'}
        size={20}
        color={isOwn ? Colors.primaryForeground : Colors.primary}
      />
      <View style={[styles.voiceBar, isOwn ? styles.voiceBarOwn : styles.voiceBarOther]} />
      <Text style={[styles.voiceDuration, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
        {formatDuration(duration || 0)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────
function MessageBubble({ message, isOwn, onLongPress, onReact, highlightId }) {
  const reactions = message.reactions || {};
  const reactionEntries = Object.entries(reactions).filter(([, count]) => count > 0);
  const isHighlighted = highlightId && message.id === highlightId;
  const isVoice = message.media_type === 'audio';
  const isImage = message.media_type === 'image';
  const isDocument = message.media_type === 'document' || message.media_type === 'file';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => onLongPress(message)}
      style={[
        styles.bubbleWrapper,
        isOwn ? styles.bubbleWrapperOwn : styles.bubbleWrapperOther,
        isHighlighted && styles.bubbleHighlight,
      ]}
    >
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {/* Voice message */}
        {isVoice && message.media_url ? (
          <VoiceMessageBubble
            mediaUrl={message.media_url}
            duration={message.duration}
            isOwn={isOwn}
          />
        ) : null}

        {/* Image attachment */}
        {isImage && message.media_url ? (
          <Image
            source={{ uri: message.media_url }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        ) : null}

        {/* Document attachment */}
        {isDocument && message.media_url ? (
          <TouchableOpacity
            style={styles.docCard}
            onPress={() => Linking.openURL(message.media_url).catch(() => {})}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={24} color={Colors.primary} />
            <Text
              style={[styles.docName, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}
              numberOfLines={1}
            >
              {message.file_name || 'Document'}
            </Text>
            <Ionicons name="download-outline" size={18} color={isOwn ? Colors.primaryForeground : Colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}

        {/* Text content */}
        {message.content ? (
          <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
            {message.content}
          </Text>
        ) : null}

        <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>
          {formatTimeAgo(message.created_at)}
        </Text>
      </View>

      {/* Reaction pills */}
      {reactionEntries.length > 0 ? (
        <View style={styles.reactionRow}>
          {reactionEntries.map(([key, count]) => (
            <TouchableOpacity
              key={key}
              style={styles.reactionPill}
              onPress={() => onReact(message, key)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{EMOJI_MAP[key] || key}</Text>
              <Text style={styles.reactionCount}>{count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
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
function ChatHeader({ otherUser, onlineStatus, onBack, onSearchToggle, wsConnected }) {
  return (
    <View style={styles.chatHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
      </TouchableOpacity>
      <Avatar uri={otherUser.avatar} name={otherUser.name || ''} size={36} />
      <View style={styles.chatHeaderInfo}>
        <Text style={styles.chatHeaderName} numberOfLines={1}>{otherUser.name || 'Unknown'}</Text>
        <View style={styles.onlineRow}>
          <View style={[styles.onlineDot, { backgroundColor: onlineStatus ? '#22c55e' : Colors.mutedForeground }]} />
          <Text style={styles.onlineText}>{onlineStatus ? 'Online' : 'Offline'}</Text>
          {wsConnected ? (
            <View style={styles.wsIndicator}>
              <Ionicons name="flash" size={10} color={Colors.emerald} />
            </View>
          ) : null}
        </View>
      </View>
      <TouchableOpacity onPress={onSearchToggle} style={styles.headerIconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="search" size={20} color={Colors.foreground} />
      </TouchableOpacity>
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

// ─── Reaction Picker Row ────────────────────────────────────────────────────
function ReactionPicker({ onSelect }) {
  return (
    <View style={styles.reactionPicker}>
      {Object.entries(EMOJI_MAP).map(([key, emoji]) => (
        <TouchableOpacity key={key} onPress={() => onSelect(key)} style={styles.reactionPickerItem} activeOpacity={0.6}>
          <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── File Preview Bar ───────────────────────────────────────────────────────
function FilePreviewBar({ file, onClear }) {
  if (!file) return null;
  const isImage = file.type?.startsWith('image');
  return (
    <View style={styles.filePreviewBar}>
      {isImage && file.uri ? (
        <Image source={{ uri: file.uri }} style={styles.filePreviewThumb} />
      ) : (
        <Ionicons name="document-text" size={24} color={Colors.primary} />
      )}
      <Text style={styles.filePreviewName} numberOfLines={1}>{file.name || 'File'}</Text>
      <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={20} color={Colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Recording Indicator ────────────────────────────────────────────────────
function RecordingIndicator({ duration }) {
  return (
    <View style={styles.recordingBar}>
      <View style={styles.recordingDot} />
      <Text style={styles.recordingText}>Recording {formatDuration(duration)}</Text>
      <Text style={styles.recordingHint}>Release to send</Text>
    </View>
  );
}

// ─── Message Search Bar ─────────────────────────────────────────────────────
function MessageSearchBar({ convoId, onSelectResult, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearching(true);
      chatAPI.searchMessages(convoId, query, 1)
        .then((res) => setResults(res.data?.results || res.data || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, convoId]);

  return (
    <View style={styles.msgSearchContainer}>
      <View style={styles.msgSearchInputRow}>
        <Ionicons name="search" size={16} color={Colors.mutedForeground} />
        <TextInput
          style={styles.msgSearchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search messages..."
          placeholderTextColor={Colors.mutedForeground}
          autoFocus
          returnKeyType="search"
        />
        {searching ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color={Colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
          style={styles.msgSearchResults}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.msgSearchResultRow}
              onPress={() => onSelectResult(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.msgSearchResultText} numberOfLines={2}>{item.content}</Text>
              <Text style={styles.msgSearchResultTime}>{formatTimeAgo(item.created_at)}</Text>
            </TouchableOpacity>
          )}
        />
      ) : null}
    </View>
  );
}

// ─── Main ChatScreen ────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { connected: wsConnected, sendTyping: wsSendTyping, on: wsOn, off: wsOff } = useChatWebSocket();

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

  // Reaction action sheet state
  const [actionMessage, setActionMessage] = useState(null);

  // File upload state
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Voice recording state
  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef(null);

  // Message search state
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [highlightMsgId, setHighlightMsgId] = useState(null);

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConvoRef = useRef(null);

  // Keep a ref in sync for WS handlers
  useEffect(() => {
    activeConvoRef.current = activeConvo;
  }, [activeConvo]);

  // ── WebSocket event handlers ──────────────────────────────────────────────
  useEffect(() => {
    wsOn('new_message', (msg) => {
      const data = msg.message || msg;
      if (activeConvoRef.current && data.conversation_id === activeConvoRef.current.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [data, ...prev];
        });
      }
      // Also refresh conversation list preview
      chatAPI.conversations()
        .then((res) => {
          const convos = res.data || [];
          setConversations(convos);
          setFilteredConvos(convos);
        })
        .catch(() => {});
    });

    wsOn('typing', (msg) => {
      if (
        activeConvoRef.current &&
        msg.conversation_id === activeConvoRef.current.id &&
        msg.user_id !== user?.id
      ) {
        setIsOtherTyping(true);
        setTimeout(() => setIsOtherTyping(false), 3000);
      }
    });

    wsOn('online_status', (msg) => {
      if (msg.user_id === otherUser?.id) {
        setOtherOnline(msg.online);
      }
    });

    wsOn('message_deleted', (msg) => {
      if (activeConvoRef.current && msg.conversation_id === activeConvoRef.current.id) {
        setMessages((prev) => prev.filter((m) => m.id !== msg.message_id));
      }
    });

    wsOn('messages_read', (msg) => {
      if (activeConvoRef.current && msg.conversation_id === activeConvoRef.current.id) {
        setMessages((prev) =>
          prev.map((m) => (m.sender_id === user?.id ? { ...m, read: true } : m)),
        );
      }
    });

    wsOn('message_reaction', (msg) => {
      if (activeConvoRef.current && msg.conversation_id === activeConvoRef.current.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.message_id
              ? { ...m, reactions: msg.reactions || m.reactions }
              : m,
          ),
        );
      }
    });

    return () => {
      wsOff('new_message');
      wsOff('typing');
      wsOff('online_status');
      wsOff('message_deleted');
      wsOff('messages_read');
      wsOff('message_reaction');
    };
  }, [wsOn, wsOff, user?.id, otherUser?.id]);

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

  // Poll conversations every 5 seconds — only when WS is disconnected
  useEffect(() => {
    if (activeConvo) return;
    if (wsConnected) return;
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
  }, [activeConvo, searchQuery, wsConnected]);

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

  // Poll messages every 3 seconds when in active chat — only when WS is disconnected
  useEffect(() => {
    if (!activeConvo) return;
    if (wsConnected) return;
    const interval = setInterval(() => {
      chatAPI.getMessages(activeConvo.id)
        .then((res) => setMessages(res.data || []))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConvo, wsConnected]);

  // Poll typing status every 3 seconds — only when WS is disconnected
  useEffect(() => {
    if (!activeConvo) return;
    if (wsConnected) return;
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
  }, [activeConvo, user?.id, wsConnected]);

  // Online heartbeat every 15 seconds
  useEffect(() => {
    chatAPI.heartbeat().catch(() => {});
    const interval = setInterval(() => {
      chatAPI.heartbeat().catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Check other user online status — only when WS is disconnected
  useEffect(() => {
    if (!otherUser) return;
    if (wsConnected) return;
    const checkOnline = () => {
      chatAPI.onlineStatus(otherUser.id)
        .then((res) => setOtherOnline(res.data?.online || false))
        .catch(() => {});
    };
    checkOnline();
    const interval = setInterval(checkOnline, 10000);
    return () => clearInterval(interval);
  }, [otherUser, wsConnected]);

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
    if ((!msgText.trim() && !pendingFile) || !activeConvo || sending) return;
    const text = msgText.trim();
    setMsgText('');
    setSending(true);

    try {
      let mediaPayload = {};

      // Upload pending file first if present
      if (pendingFile) {
        setUploading(true);
        try {
          const fileObj = {
            uri: pendingFile.uri,
            name: pendingFile.name || 'file',
            type: pendingFile.mimeType || pendingFile.type || 'application/octet-stream',
          };
          const uploadRes = await chatAPI.uploadFile(fileObj);
          const uploadData = uploadRes.data || {};
          mediaPayload = {
            media_url: uploadData.url || uploadData.media_url,
            media_type: pendingFile.mediaType || (pendingFile.type?.startsWith('image') ? 'image' : 'document'),
            file_name: pendingFile.name || 'file',
          };
        } catch {
          Alert.alert('Error', 'Failed to upload file');
          setSending(false);
          setUploading(false);
          return;
        }
        setUploading(false);
        setPendingFile(null);
      }

      await chatAPI.sendMessage(activeConvo.id, { content: text || undefined, ...mediaPayload });
      // If WS is connected the message will arrive via WS, otherwise refresh
      if (!wsConnected) {
        const res = await chatAPI.getMessages(activeConvo.id);
        setMessages(res.data || []);
      }
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
    if (wsConnected) {
      wsSendTyping(activeConvo.id);
    } else {
      chatAPI.setTyping(activeConvo.id).catch(() => {});
    }
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  // ── Long-press message (reaction + delete) ────────────────────────────
  const handleMessageLongPress = (message) => {
    setActionMessage(message);
  };

  const handleReaction = async (message, emojiKey) => {
    setActionMessage(null);
    if (!activeConvo) return;
    try {
      await chatAPI.reactToMessage(activeConvo.id, message.id, emojiKey);
      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== message.id) return m;
          const reactions = { ...(m.reactions || {}) };
          reactions[emojiKey] = (reactions[emojiKey] || 0) + 1;
          return { ...m, reactions };
        }),
      );
    } catch {
      /* ignore */
    }
  };

  const handleDeleteMessage = (message) => {
    setActionMessage(null);
    if (message.sender_id !== user?.id) return;
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

  // ── File attachment ───────────────────────────────────────────────────────
  const handleAttach = () => {
    const options = [];
    if (ImagePicker) options.push({ text: 'Photo', onPress: pickImage });
    if (DocumentPicker) options.push({ text: 'Document', onPress: pickDocument });
    if (options.length === 0) {
      Alert.alert('Unavailable', 'File picker is not available on this device.');
      return;
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Attach File', 'Choose a source', options);
  };

  const pickImage = async () => {
    if (!ImagePicker) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setPendingFile({
          uri: asset.uri,
          name: asset.fileName || 'photo.jpg',
          type: asset.mimeType || 'image/jpeg',
          mimeType: asset.mimeType || 'image/jpeg',
          mediaType: 'image',
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const pickDocument = async () => {
    if (!DocumentPicker) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setPendingFile({
          uri: asset.uri,
          name: asset.name || 'document',
          type: asset.mimeType || 'application/octet-stream',
          mimeType: asset.mimeType || 'application/octet-stream',
          mediaType: 'document',
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  // ── Voice recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!Audio) {
      Alert.alert('Unavailable', 'Audio recording is not available on this device.');
      return;
    }
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is needed to record.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets?.HIGH_QUALITY || {
        android: { extension: '.m4a', outputFormat: 2, audioEncoder: 3, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 },
        ios: { extension: '.m4a', outputFormat: 'aac', audioQuality: 127, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      });
      await rec.startAsync();
      setRecording(rec);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const duration = recordingDuration;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordingDuration(0);

      if (!uri || duration < 1) return; // too short, discard

      setSending(true);
      const fileObj = {
        uri,
        name: 'voice.m4a',
        type: 'audio/m4a',
      };
      const uploadRes = await chatAPI.uploadFile(fileObj);
      const uploadData = uploadRes.data || {};
      await chatAPI.sendMessage(activeConvo.id, {
        media_url: uploadData.url || uploadData.media_url,
        media_type: 'audio',
        file_name: 'voice.m4a',
        duration,
      });
      if (!wsConnected) {
        const res = await chatAPI.getMessages(activeConvo.id);
        setMessages(res.data || []);
      }
    } catch {
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setSending(false);
      setRecording(null);
      setRecordingDuration(0);
    }
  };

  // ── Message search scroll-to ──────────────────────────────────────────────
  const handleSearchResult = (msg) => {
    setHighlightMsgId(msg.id);
    setShowMsgSearch(false);
    // Try to scroll to the message in the list
    const idx = messages.findIndex((m) => m.id === msg.id);
    if (idx >= 0 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    }
    // Clear highlight after a few seconds
    setTimeout(() => setHighlightMsgId(null), 3000);
  };

  // ── Go back to conversation list ────────────────────────────────────────
  const handleBack = () => {
    setActiveConvo(null);
    setOtherUser(null);
    setMessages([]);
    setMsgText('');
    setIsOtherTyping(false);
    setActionMessage(null);
    setPendingFile(null);
    setShowMsgSearch(false);
    setHighlightMsgId(null);
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
    const hasText = msgText.trim().length > 0;
    const hasPendingFile = !!pendingFile;
    const isRecording = !!recording;

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ChatHeader
          otherUser={otherUser}
          onlineStatus={otherOnline}
          onBack={handleBack}
          onSearchToggle={() => setShowMsgSearch((v) => !v)}
          wsConnected={wsConnected}
        />

        {/* Message search bar */}
        {showMsgSearch ? (
          <MessageSearchBar
            convoId={activeConvo.id}
            onSelectResult={handleSearchResult}
            onClose={() => setShowMsgSearch(false)}
          />
        ) : null}

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
                  onLongPress={handleMessageLongPress}
                  onReact={handleReaction}
                  highlightId={highlightMsgId}
                />
              )}
              inverted
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={isOtherTyping ? <TypingIndicator /> : null}
              ListEmptyComponent={
                <View style={styles.emptyChatContainer}>
                  <Text style={styles.emptyChatIcon}>{'\u{1F4AC}'}</Text>
                  <Text style={styles.emptyChatText}>No messages yet</Text>
                  <Text style={styles.emptyChatSubtext}>
                    Say hello to {otherUser.name || 'your friend'}!
                  </Text>
                </View>
              }
              onScrollToIndexFailed={() => {}}
            />
          )}

          {/* Reaction / Delete action sheet */}
          {actionMessage ? (
            <View style={styles.actionSheet}>
              <ReactionPicker onSelect={(key) => handleReaction(actionMessage, key)} />
              {actionMessage.sender_id === user?.id ? (
                <TouchableOpacity
                  style={styles.actionDeleteBtn}
                  onPress={() => handleDeleteMessage(actionMessage)}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                  <Text style={styles.actionDeleteText}>Delete</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.actionCancelBtn}
                onPress={() => setActionMessage(null)}
              >
                <Text style={styles.actionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Recording indicator */}
          {isRecording ? <RecordingIndicator duration={recordingDuration} /> : null}

          {/* File preview */}
          <FilePreviewBar file={pendingFile} onClear={() => setPendingFile(null)} />

          {/* Input bar */}
          <View style={styles.inputBar}>
            {/* Attachment button */}
            <TouchableOpacity
              onPress={handleAttach}
              style={styles.inputIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="attach" size={22} color={Colors.mutedForeground} />
            </TouchableOpacity>

            <TextInput
              style={styles.msgInput}
              value={msgText}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              placeholderTextColor={Colors.mutedForeground}
              multiline
              maxLength={2000}
            />

            {/* Send or Mic button */}
            {hasText || hasPendingFile ? (
              <TouchableOpacity
                style={[styles.sendButton, ((!hasText && !hasPendingFile) || sending || uploading) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={(!hasText && !hasPendingFile) || sending || uploading}
              >
                {sending || uploading ? (
                  <ActivityIndicator size="small" color={Colors.primaryForeground} />
                ) : (
                  <Ionicons name="send" size={18} color={Colors.primaryForeground} />
                )}
              </TouchableOpacity>
            ) : Audio ? (
              <TouchableOpacity
                style={[styles.micButton, isRecording && styles.micButtonRecording]}
                onPressIn={startRecording}
                onPressOut={stopRecordingAndSend}
                activeOpacity={0.6}
              >
                <Ionicons name="mic" size={20} color={isRecording ? Colors.destructive : Colors.primaryForeground} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendButton, styles.sendButtonDisabled]}
                disabled
              >
                <Ionicons name="send" size={18} color={Colors.primaryForeground} />
              </TouchableOpacity>
            )}
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
              icon={'\u{1F4AC}'}
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
  wsIndicator: {
    marginLeft: 2,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: Spacing.radiusSm,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
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
  bubbleHighlight: {
    borderWidth: 1,
    borderColor: Colors.amber,
    borderRadius: Spacing.radiusLg + 2,
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

  // ── Media in bubbles ──────────────────────────────────────────────────
  mediaImage: {
    width: 200,
    height: 150,
    borderRadius: Spacing.radiusMd,
    marginBottom: Spacing.xs,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  docName: {
    flex: 1,
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyMedium,
  },

  // ── Voice message ─────────────────────────────────────────────────────
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  voiceBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  voiceBarOwn: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  voiceBarOther: {
    backgroundColor: Colors.border,
  },
  voiceDuration: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
  },

  // ── Reaction pills ────────────────────────────────────────────────────
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusFull,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
  },

  // ── Reaction picker ───────────────────────────────────────────────────
  reactionPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  reactionPickerItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reactionPickerEmoji: {
    fontSize: 20,
  },

  // ── Action sheet ──────────────────────────────────────────────────────
  actionSheet: {
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  actionDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
  },
  actionDeleteText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.destructive,
  },
  actionCancelBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  actionCancelText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },

  // ── File preview bar ──────────────────────────────────────────────────
  filePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  filePreviewThumb: {
    width: 36,
    height: 36,
    borderRadius: Spacing.radiusSm,
  },
  filePreviewName: {
    flex: 1,
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.foreground,
  },

  // ── Recording indicator ───────────────────────────────────────────────
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.roseLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.destructive,
  },
  recordingText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.destructive,
  },
  recordingHint: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginLeft: 'auto',
  },

  // ── Message search ────────────────────────────────────────────────────
  msgSearchContainer: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  msgSearchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  msgSearchInput: {
    flex: 1,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.foreground,
    paddingVertical: Spacing.xs,
  },
  msgSearchResults: {
    maxHeight: 180,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  msgSearchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  msgSearchResultText: {
    flex: 1,
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.foreground,
  },
  msgSearchResultTime: {
    fontSize: 9,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
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
  inputIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  micButton: {
    backgroundColor: Colors.primary,
    borderRadius: Spacing.radiusMd,
    height: 40,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: Colors.roseLight,
  },
});
