import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { socialAPI } from '../../api';
import PostCard from '../../components/common/PostCard';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

export default function BookmarksScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadBookmarks = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      const res = await socialAPI.getBookmarks(pageNum);
      const data = res.data;
      const newPosts = Array.isArray(data) ? data : data?.posts || data?.bookmarks || [];

      if (refresh || pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }

      setHasMore(newPosts.length >= 10);
      setPage(pageNum);
    } catch (err) {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadBookmarks(1); }, [loadBookmarks]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBookmarks(1, true);
  };

  const onEndReached = () => {
    if (!loadingMore && hasMore && !refreshing) {
      setLoadingMore(true);
      loadBookmarks(page + 1);
    }
  };

  const handleUnbookmark = async (postId) => {
    try {
      await socialAPI.toggleBookmark(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      // Silently fail
    }
  };

  const handleLike = async (postId) => {
    try {
      await socialAPI.toggleLike(postId);
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? {
              ...p,
              user_liked: !p.user_liked,
              likes_count: p.user_liked ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1,
            }
          : p
      ));
    } catch (err) {
      // Silently fail
    }
  };

  const handleReact = async (postId, reaction) => {
    try {
      await socialAPI.react(postId, reaction);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const reactions = { ...(p.reactions || {}) };
        reactions[reaction] = (reactions[reaction] || 0) + 1;
        return { ...p, reactions };
      }));
    } catch (err) {
      // Silently fail
    }
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bookmarks</Text>
        <View style={{ width: 60 }} />
      </View>

      {posts.length === 0 ? (
        <EmptyState
          icon="📑"
          title="No bookmarks yet"
          subtitle="Save posts to find them here later"
          style={{ marginTop: Spacing.xl3 }}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({ item }) => (
            <PostCard
              post={{ ...item, user_bookmarked: true }}
              currentUserId={user?.id}
              onLike={handleLike}
              onReact={handleReact}
              onBookmark={handleUnbookmark}
              onUserPress={(userId) => navigation.navigate('PlayerCard', { userId })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.base },
  backBtn: { width: 60 },
  backText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  headerTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  listContent: { paddingBottom: Spacing.xl3 },

  footerLoader: { paddingVertical: Spacing.xl, alignItems: 'center' },
});
