import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { groupAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../../components/common/Avatar';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import TabBar from '../../components/common/TabBar';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'chat', label: 'Chat' },
  { key: 'members', label: 'Members' },
];

const SPORT_EMOJIS = {
  football: '⚽',
  cricket: '🏏',
  basketball: '🏀',
  badminton: '🏸',
  tennis: '🎾',
  volleyball: '🏐',
  default: '🏆',
};

function getSportEmoji(sport) {
  if (!sport) return SPORT_EMOJIS.default;
  return SPORT_EMOJIS[sport.toLowerCase()] || SPORT_EMOJIS.default;
}

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

// ─── Group Chat Message ─────────────────────────────────────────────────────
function GroupMessage({ message, isOwn }) {
  return (
    <View style={[styles.msgWrapper, isOwn ? styles.msgWrapperOwn : styles.msgWrapperOther]}>
      {!isOwn && (
        <Avatar uri={message.sender_avatar} name={message.sender_name || ''} size={28} />
      )}
      <View style={[styles.msgBubble, isOwn ? styles.msgBubbleOwn : styles.msgBubbleOther]}>
        {!isOwn && (
          <Text style={styles.msgSender} numberOfLines={1}>{message.sender_name || 'Unknown'}</Text>
        )}
        <Text style={[styles.msgText, isOwn ? styles.msgTextOwn : styles.msgTextOther]}>
          {message.content}
        </Text>
        <Text style={[styles.msgTime, isOwn ? styles.msgTimeOwn : styles.msgTimeOther]}>
          {formatTimeAgo(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

// ─── Member Row ─────────────────────────────────────────────────────────────
function MemberRow({ member, isCreator }) {
  return (
    <View style={styles.memberRow}>
      <Avatar uri={member.avatar} name={member.name || ''} size={40} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName} numberOfLines={1}>{member.name || 'Unknown'}</Text>
        {member.sport ? (
          <Text style={styles.memberSport}>{member.sport}</Text>
        ) : null}
      </View>
      {isCreator && (
        <Badge variant="amber">Admin</Badge>
      )}
    </View>
  );
}

// ─── Join Overlay ───────────────────────────────────────────────────────────
function JoinOverlay({ groupName, onJoin, loading }) {
  return (
    <View style={styles.joinOverlay}>
      <Card style={styles.joinCard}>
        <Text style={styles.joinEmoji}>🔒</Text>
        <Text style={styles.joinTitle}>Join to participate</Text>
        <Text style={styles.joinSubtext}>
          You need to be a member of {groupName} to send messages and see the full chat history.
        </Text>
        <Button onPress={onJoin} loading={loading} style={{ marginTop: Spacing.lg, width: '100%' }}>
          Join Group
        </Button>
      </Card>
    </View>
  );
}

// ─── Main GroupDetailScreen ─────────────────────────────────────────────────
export default function GroupDetailScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId } = route.params;

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  // Chat state
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  // Join state
  const [joinLoading, setJoinLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const flatListRef = useRef(null);

  const isMember = group?.members?.some((m) => m.id === user?.id) || false;
  const isCreator = group?.creator_id === user?.id;
  const memberCount = group?.member_count || group?.members?.length || 0;

  // ── Load group data ─────────────────────────────────────────────────────
  const loadGroup = useCallback(async () => {
    try {
      const res = await groupAPI.get(groupId);
      setGroup(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load group details');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, navigation]);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  // ── Load messages ───────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!isMember) return;
    setMsgLoading(true);
    try {
      const res = await groupAPI.getMessages(groupId);
      setMessages(res.data || []);
    } catch (err) {
      // Silent fail for messages polling
    } finally {
      setMsgLoading(false);
    }
  }, [groupId, isMember]);

  useEffect(() => {
    if (isMember && activeTab === 'chat') {
      loadMessages();
    }
  }, [isMember, activeTab, groupId]);

  // Poll messages every 5 seconds
  useEffect(() => {
    if (!isMember || activeTab !== 'chat') return;
    const interval = setInterval(() => {
      groupAPI.getMessages(groupId)
        .then((res) => setMessages(res.data || []))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [isMember, activeTab, groupId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadGroup();
    if (isMember && activeTab === 'chat') {
      loadMessages();
    }
  };

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!msgText.trim() || sending) return;
    const text = msgText.trim();
    setMsgText('');
    setSending(true);
    try {
      await groupAPI.sendMessage(groupId, { content: text });
      const res = await groupAPI.getMessages(groupId);
      setMessages(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to send message');
      setMsgText(text);
    } finally {
      setSending(false);
    }
  };

  // ── Join group ──────────────────────────────────────────────────────────
  const handleJoin = async () => {
    setJoinLoading(true);
    try {
      await groupAPI.join(groupId);
      await loadGroup();
      loadMessages();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to join group');
    } finally {
      setJoinLoading(false);
    }
  };

  // ── Leave group ─────────────────────────────────────────────────────────
  const handleLeave = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setLeaveLoading(true);
          try {
            await groupAPI.leave(groupId);
            Alert.alert('Left Group', 'You have left the group.');
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to leave group');
          } finally {
            setLeaveLoading(false);
          }
        },
      },
    ]);
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          icon="❌"
          title="Group not found"
          subtitle="This group may have been removed"
          actionLabel="Go Back"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  // ── Render Chat Tab ─────────────────────────────────────────────────────
  const renderChatTab = () => {
    if (!isMember) {
      return <JoinOverlay groupName={group.name} onJoin={handleJoin} loading={joinLoading} />;
    }

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {msgLoading && messages.length === 0 ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id?.toString()}
            renderItem={({ item }) => (
              <GroupMessage message={item} isOwn={item.sender_id === user?.id} />
            )}
            inverted
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyChatContainer}>
                <Text style={styles.emptyChatIcon}>💬</Text>
                <Text style={styles.emptyChatText}>No messages yet</Text>
                <Text style={styles.emptyChatSubtext}>Be the first to start the conversation!</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.msgInput}
            value={msgText}
            onChangeText={setMsgText}
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
    );
  };

  // ── Render Members Tab ──────────────────────────────────────────────────
  const renderMembersTab = () => {
    const members = group.members || [];

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          data={members}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <MemberRow member={item} isCreator={item.id === group.creator_id} />
          )}
          contentContainerStyle={
            members.length === 0
              ? { flex: 1 }
              : { paddingBottom: Spacing.xl3 }
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="👥"
              title="No members yet"
              subtitle="Be the first to join this group"
            />
          }
          ListFooterComponent={
            isMember && !isCreator ? (
              <View style={styles.leaveSection}>
                <Button
                  variant="destructive"
                  size="sm"
                  onPress={handleLeave}
                  loading={leaveLoading}
                >
                  Leave Group
                </Button>
              </View>
            ) : null
          }
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerGroupName} numberOfLines={1}>{group.name}</Text>
            {group.sport ? (
              <Text style={styles.headerSportEmoji}>{getSportEmoji(group.sport)}</Text>
            ) : null}
          </View>
          <View style={styles.headerMetaRow}>
            <Text style={styles.headerMemberCount}>
              👥 {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
            {group.sport ? (
              <Badge variant="default" style={{ marginLeft: Spacing.sm }}>
                {group.sport}
              </Badge>
            ) : null}
          </View>
        </View>
      </View>

      {/* Tabs */}
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {activeTab === 'chat' ? renderChatTab() : renderMembersTab()}
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
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
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
  headerCenter: {
    flex: 1,
    gap: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerGroupName: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
    flexShrink: 1,
  },
  headerSportEmoji: {
    fontSize: 18,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMemberCount: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },

  // ── Chat Messages ───────────────────────────────────────────────────────
  chatContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  msgWrapper: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    maxWidth: '85%',
    gap: Spacing.sm,
  },
  msgWrapperOwn: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  msgWrapperOther: {
    alignSelf: 'flex-start',
  },
  msgBubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusLg,
    flexShrink: 1,
  },
  msgBubbleOwn: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Spacing.xs,
  },
  msgBubbleOther: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  msgSender: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    color: Colors.accent,
    marginBottom: 2,
  },
  msgText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    lineHeight: 20,
  },
  msgTextOwn: {
    color: Colors.primaryForeground,
  },
  msgTextOther: {
    color: Colors.foreground,
  },
  msgTime: {
    fontSize: 9,
    fontFamily: Typography.fontBody,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  msgTimeOwn: {
    color: 'rgba(8, 14, 29, 0.5)',
  },
  msgTimeOther: {
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

  // ── Members ─────────────────────────────────────────────────────────────
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  memberSport: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  leaveSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl2,
    paddingHorizontal: Spacing.base,
  },

  // ── Join Overlay ────────────────────────────────────────────────────────
  joinOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  joinCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl2,
    paddingHorizontal: Spacing.xl,
    width: '100%',
  },
  joinEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  joinTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
    textAlign: 'center',
  },
  joinSubtext: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
});
