import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl, TextInput, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { socialAPI, recommendationAPI } from '../../api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import UserRow from '../../components/common/UserRow';
import PostCard from '../../components/common/PostCard';
import ModalSheet from '../../components/common/ModalSheet';
import TabBar from '../../components/common/TabBar';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const FEED_TABS = [
  { key: 'for_you', label: 'For You' },
  { key: 'following', label: 'Following' },
];

const POST_TYPES = [
  { key: 'text', label: 'Text', icon: '📝' },
  { key: 'match_result', label: 'Match Result', icon: '🏆' },
  { key: 'highlight', label: 'Highlight', icon: '🎬' },
  { key: 'question', label: 'Question', icon: '❓' },
];

function StoryBubble({ story, onPress }) {
  const hasViewed = story.viewed;
  return (
    <TouchableOpacity style={styles.storyBubble} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.storyRing, hasViewed ? styles.storyRingViewed : styles.storyRingActive]}>
        <Avatar uri={story.user_avatar} name={story.user_name || ''} size={56} />
      </View>
      <Text style={styles.storyName} numberOfLines={1}>{story.user_name?.split(' ')[0] || 'User'}</Text>
    </TouchableOpacity>
  );
}

function CreateStoryBubble({ onPress, userAvatar, userName }) {
  return (
    <TouchableOpacity style={styles.storyBubble} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.createStoryRing}>
        <Avatar uri={userAvatar} name={userName || ''} size={56} />
        <View style={styles.createStoryPlus}>
          <Text style={styles.createStoryPlusText}>+</Text>
        </View>
      </View>
      <Text style={styles.storyName} numberOfLines={1}>Your Story</Text>
    </TouchableOpacity>
  );
}

function EngagementCard({ engagement }) {
  if (!engagement) return null;
  return (
    <Card style={styles.engagementCard}>
      <View style={styles.engagementHeader}>
        <View style={styles.engagementIconBox}>
          <Text style={{ fontSize: 18 }}>🔥</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.engagementTitle}>Your Streak</Text>
          <Text style={styles.engagementSub}>Keep engaging to grow your streak</Text>
        </View>
      </View>
      <View style={styles.engagementStats}>
        <View style={styles.engagementStat}>
          <Text style={[styles.engagementStatValue, { color: Colors.primary }]}>{engagement.streak || 0}</Text>
          <Text style={styles.engagementStatLabel}>DAY STREAK</Text>
        </View>
        <View style={styles.engagementStat}>
          <Text style={[styles.engagementStatValue, { color: Colors.violet }]}>{engagement.posts_count || 0}</Text>
          <Text style={styles.engagementStatLabel}>POSTS</Text>
        </View>
        <View style={styles.engagementStat}>
          <Text style={[styles.engagementStatValue, { color: Colors.amber }]}>{engagement.likes_received || 0}</Text>
          <Text style={styles.engagementStatLabel}>LIKES</Text>
        </View>
        <View style={styles.engagementStat}>
          <Text style={[styles.engagementStatValue, { color: Colors.sky }]}>{engagement.followers_count || 0}</Text>
          <Text style={styles.engagementStatLabel}>FOLLOWERS</Text>
        </View>
      </View>
    </Card>
  );
}

function SuggestedFollowsSection({ suggestions, onFollow, onUserPress }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <View style={styles.suggestedSection}>
      <Text style={styles.sectionTitle}>Suggested Follows</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedScroll}>
        {suggestions.map((s) => (
          <Card key={s.id} style={styles.suggestedCard}>
            <TouchableOpacity style={styles.suggestedUserInfo} onPress={() => onUserPress(s.id)} activeOpacity={0.75}>
              <Avatar uri={s.avatar} name={s.name || ''} size={48} />
              <Text style={styles.suggestedName} numberOfLines={1}>{s.name}</Text>
              {s.skill_rating ? (
                <Text style={styles.suggestedRating}>{s.skill_rating} SR</Text>
              ) : null}
            </TouchableOpacity>
            <Button size="sm" onPress={() => onFollow(s.id)} style={{ marginTop: Spacing.sm }}>
              Follow
            </Button>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

function PostComposer({ visible, onClose, onSubmit }) {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please write something before posting');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ content: content.trim(), post_type: postType });
      setContent('');
      setPostType('text');
      onClose();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} title="Create Post">
      <View style={styles.composerTypeRow}>
        {POST_TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.composerTypeChip, postType === t.key && styles.composerTypeChipActive]}
            onPress={() => setPostType(t.key)}
          >
            <Text style={{ fontSize: 14 }}>{t.icon}</Text>
            <Text style={[styles.composerTypeText, postType === t.key && styles.composerTypeTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.composerInputBox}>
        <TextInput
          style={styles.composerInput}
          value={content}
          onChangeText={setContent}
          placeholder="What's on your mind?"
          placeholderTextColor={Colors.mutedForeground}
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />
      </View>

      <View style={styles.composerFooter}>
        <Text style={styles.composerCharCount}>{content.length}/1000</Text>
        <Button onPress={handleSubmit} loading={submitting} disabled={!content.trim()} size="sm">
          Post
        </Button>
      </View>
    </ModalSheet>
  );
}

export default function SocialFeedScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('for_you');
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [engagement, setEngagement] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [composerVisible, setComposerVisible] = useState(false);
  const flatListRef = useRef(null);

  const loadFeed = async (pageNum = 1, append = false) => {
    try {
      const res = await socialAPI.getFeed(pageNum, activeTab);
      const newPosts = res.data?.posts || res.data || [];
      if (append) {
        setPosts((prev) => [...prev, ...newPosts]);
      } else {
        setPosts(newPosts);
      }
      setHasMore(newPosts.length >= 10);
    } catch (err) {
      if (!append) setPosts([]);
    }
  };

  const loadStories = async () => {
    try {
      const res = await socialAPI.getStories();
      setStories(res.data || []);
    } catch {
      setStories([]);
    }
  };

  const loadEngagement = async () => {
    try {
      const res = await socialAPI.myEngagement();
      setEngagement(res.data || null);
    } catch {
      setEngagement(null);
    }
  };

  const loadSuggestions = async () => {
    try {
      const res = await socialAPI.suggestedFollows();
      setSuggestions(res.data || []);
    } catch {
      setSuggestions([]);
    }
  };

  const loadAll = async () => {
    try {
      await Promise.all([
        loadFeed(1, false),
        loadStories(),
        loadEngagement(),
        loadSuggestions(),
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadAll();
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadAll();
  };

  const onEndReached = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadFeed(nextPage, true).finally(() => setLoadingMore(false));
  };

  const handleLike = async (postId) => {
    try {
      await socialAPI.toggleLike(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                user_liked: !p.user_liked,
                likes_count: p.user_liked ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1,
              }
            : p
        )
      );
    } catch {
      Alert.alert('Error', 'Failed to like post');
    }
  };

  const handleReact = async (postId, reaction) => {
    try {
      await socialAPI.react(postId, reaction);
      loadFeed(1, false);
    } catch {
      Alert.alert('Error', 'Failed to react');
    }
  };

  const handleBookmark = async (postId) => {
    try {
      await socialAPI.toggleBookmark(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, user_bookmarked: !p.user_bookmarked } : p
        )
      );
    } catch {
      Alert.alert('Error', 'Failed to bookmark');
    }
  };

  const handleComment = (postId) => {
    navigation.navigate('Comments', { postId });
  };

  const handleDelete = (postId) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await socialAPI.deletePost(postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch {
            Alert.alert('Error', 'Failed to delete post');
          }
        },
      },
    ]);
  };

  const handleCreatePost = async (data) => {
    await socialAPI.createPost(data);
    Alert.alert('Posted!', 'Your post is now live.');
    setPage(1);
    loadFeed(1, false);
  };

  const handleViewStory = async (story) => {
    try {
      await socialAPI.viewStory(story.id);
      setStories((prev) =>
        prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s))
      );
    } catch {
      // silent
    }
  };

  const handleCreateStory = () => {
    navigation.navigate('CreateStory');
  };

  const handleFollow = async (userId) => {
    try {
      await socialAPI.toggleFollow(userId);
      setSuggestions((prev) => prev.filter((s) => s.id !== userId));
      Alert.alert('Followed!', 'You are now following this player.');
    } catch {
      Alert.alert('Error', 'Failed to follow');
    }
  };

  const handleUserPress = (userId) => {
    navigation.navigate('PlayerCard', { userId });
  };

  const renderHeader = () => (
    <View>
      {/* Stories Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContainer}
      >
        <CreateStoryBubble
          onPress={handleCreateStory}
          userAvatar={user?.avatar}
          userName={user?.name}
        />
        {stories.map((story) => (
          <StoryBubble
            key={story.id}
            story={story}
            onPress={() => handleViewStory(story)}
          />
        ))}
      </ScrollView>

      {/* Engagement Card */}
      <EngagementCard engagement={engagement} />

      {/* Suggested Follows */}
      <SuggestedFollowsSection
        suggestions={suggestions}
        onFollow={handleFollow}
        onUserPress={handleUserPress}
      />
    </View>
  );

  const renderPost = useCallback(
    ({ item }) => (
      <PostCard
        post={item}
        currentUserId={user?.id}
        onLike={handleLike}
        onReact={handleReact}
        onBookmark={handleBookmark}
        onComment={handleComment}
        onDelete={handleDelete}
        onUserPress={handleUserPress}
      />
    ),
    [user?.id]
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>📭</Text>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySubText}>
        {activeTab === 'following'
          ? 'Follow other players to see their posts here'
          : 'Be the first to post something!'}
      </Text>
      <Button onPress={() => setComposerVisible(true)} style={{ marginTop: Spacing.lg }}>
        Create a Post
      </Button>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>COMMUNITY</Text>
          <Text style={styles.headerTitle}>Social Feed</Text>
        </View>
      </View>

      {/* Feed Tabs */}
      <TabBar tabs={FEED_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Feed List */}
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      />

      {/* FAB - Create Post */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setComposerVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Post Composer Modal */}
      <PostComposer
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        onSubmit={handleCreatePost}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
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
    marginTop: 4,
  },
  listContent: { paddingBottom: Spacing.xl3 + 60 },

  // Stories
  storiesContainer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  storyBubble: {
    alignItems: 'center',
    width: 72,
  },
  storyRing: {
    padding: 3,
    borderRadius: Spacing.radiusFull,
    borderWidth: 2,
  },
  storyRingActive: {
    borderColor: Colors.primary,
  },
  storyRingViewed: {
    borderColor: Colors.border,
  },
  storyName: {
    fontSize: 10,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginTop: Spacing.xs,
    textAlign: 'center',
    width: 68,
  },
  createStoryRing: {
    padding: 3,
    borderRadius: Spacing.radiusFull,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  createStoryPlus: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  createStoryPlusText: {
    fontSize: 14,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.primaryForeground,
    lineHeight: 16,
  },

  // Engagement Card
  engagementCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  engagementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  engagementIconBox: {
    width: 36,
    height: 36,
    borderRadius: Spacing.radiusMd,
    backgroundColor: Colors.amberLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  engagementTitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  engagementSub: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  engagementStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  engagementStat: {
    alignItems: 'center',
    flex: 1,
  },
  engagementStatValue: {
    fontSize: Typography.xl,
    fontFamily: Typography.fontDisplayBlack,
  },
  engagementStatLabel: {
    fontSize: 9,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Suggested Follows
  suggestedSection: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  suggestedScroll: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  suggestedCard: {
    width: 130,
    alignItems: 'center',
    padding: Spacing.md,
  },
  suggestedUserInfo: {
    alignItems: 'center',
  },
  suggestedName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    marginTop: Spacing.sm,
    textAlign: 'center',
    width: 100,
  },
  suggestedRating: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginTop: 2,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.xl,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
  },
  emptySubText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // Footer loader
  footerLoader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.base,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 28,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.primaryForeground,
    lineHeight: 30,
  },

  // Post Composer
  composerTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  composerTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusFull,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.secondary,
  },
  composerTypeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  composerTypeText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
  },
  composerTypeTextActive: {
    color: Colors.primary,
  },
  composerInputBox: {
    backgroundColor: Colors.background,
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  composerInput: {
    height: 120,
    padding: Spacing.md,
    color: Colors.foreground,
    fontSize: Typography.base,
    fontFamily: Typography.fontBody,
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  composerCharCount: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
});
