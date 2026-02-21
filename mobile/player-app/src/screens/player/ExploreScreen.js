import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { socialAPI } from '../../api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import UserRow from '../../components/common/UserRow';
import PostCard from '../../components/common/PostCard';
import SearchBar from '../../components/common/SearchBar';
import EmptyState from '../../components/common/EmptyState';
import TabBar from '../../components/common/TabBar';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const CATEGORY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'posts', label: 'Posts' },
  { key: 'venues', label: 'Venues' },
];

function VenueCard({ venue, onPress }) {
  const rating = venue.average_rating ? venue.average_rating.toFixed(1) : null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <Card style={styles.venueCard} padding={false}>
        {venue.images?.length > 0 ? (
          <Image source={{ uri: venue.images[0] }} style={styles.venueImage} resizeMode="cover" />
        ) : (
          <View style={[styles.venueImage, styles.venuePlaceholder]}>
            <Text style={{ fontSize: 32 }}>🏟️</Text>
          </View>
        )}
        <View style={styles.venueContent}>
          <View style={styles.venueTitleRow}>
            <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
            {rating && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingStar}>⭐</Text>
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            )}
          </View>
          <Text style={styles.venueLocation} numberOfLines={1}>
            📍 {venue.area}{venue.city ? `, ${venue.city}` : ''}
          </Text>
          {venue.sports?.length > 0 && (
            <View style={styles.venueSports}>
              {venue.sports.slice(0, 3).map((s) => (
                <Badge key={s} variant="secondary" style={{ marginRight: 4, marginBottom: 4 }}>
                  {s}
                </Badge>
              ))}
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function PeopleSection({ people, onFollow, onUserPress, followingMap }) {
  if (!people || people.length === 0) return null;
  return (
    <View style={styles.resultSection}>
      <Text style={styles.resultSectionTitle}>People</Text>
      {people.map((person) => (
        <UserRow
          key={person.id}
          user={person}
          subtitle={person.skill_rating ? `${person.skill_rating} SR` : null}
          onPress={() => onUserPress(person.id)}
          rightComponent={
            <Button
              size="sm"
              variant={followingMap[person.id] ? 'secondary' : 'primary'}
              onPress={() => onFollow(person.id)}
            >
              {followingMap[person.id] ? 'Following' : 'Follow'}
            </Button>
          }
        />
      ))}
    </View>
  );
}

function PostsSection({ posts, currentUserId, onLike, onBookmark, onComment, onUserPress }) {
  if (!posts || posts.length === 0) return null;
  return (
    <View style={styles.resultSection}>
      <Text style={styles.resultSectionTitle}>Posts</Text>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          onLike={onLike}
          onBookmark={onBookmark}
          onComment={onComment}
          onUserPress={onUserPress}
        />
      ))}
    </View>
  );
}

function VenuesSection({ venues, onVenuePress }) {
  if (!venues || venues.length === 0) return null;
  return (
    <View style={styles.resultSection}>
      <Text style={styles.resultSectionTitle}>Venues</Text>
      <View style={{ gap: Spacing.sm }}>
        {venues.map((venue) => (
          <VenueCard key={venue.id} venue={venue} onPress={() => onVenuePress(venue)} />
        ))}
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [followingMap, setFollowingMap] = useState({});
  const debounceRef = useRef(null);

  const doSearch = async (searchQuery, searchCategory, pageNum = 1, append = false) => {
    if (!searchQuery.trim()) {
      setResults(null);
      return;
    }
    try {
      const res = await socialAPI.explore(searchQuery.trim(), searchCategory, pageNum);
      const data = res.data || {};
      if (append && results) {
        setResults({
          people: [...(results.people || []), ...(data.people || [])],
          posts: [...(results.posts || []), ...(data.posts || [])],
          venues: [...(results.venues || []), ...(data.venues || [])],
        });
      } else {
        setResults(data);
      }
      const totalNew = (data.people?.length || 0) + (data.posts?.length || 0) + (data.venues?.length || 0);
      setHasMore(totalNew >= 10);
    } catch (err) {
      if (!append) {
        setResults({ people: [], posts: [], venues: [] });
      }
      Alert.alert('Error', 'Failed to search. Please try again.');
    }
  };

  const handleSearch = useCallback(
    (text) => {
      setQuery(text);
      setPage(1);
      setHasMore(true);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!text.trim()) {
        setResults(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        await doSearch(text, category, 1, false);
        setLoading(false);
      }, 400);
    },
    [category]
  );

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setPage(1);
    setHasMore(true);
    if (query.trim()) {
      setLoading(true);
      doSearch(query, newCategory, 1, false).finally(() => setLoading(false));
    }
  };

  const onRefresh = () => {
    if (!query.trim()) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    doSearch(query, category, 1, false).finally(() => setRefreshing(false));
  };

  const onEndReached = () => {
    if (loadingMore || !hasMore || !query.trim()) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch(query, category, nextPage, true).finally(() => setLoadingMore(false));
  };

  const handleFollow = async (userId) => {
    try {
      await socialAPI.toggleFollow(userId);
      setFollowingMap((prev) => ({
        ...prev,
        [userId]: !prev[userId],
      }));
    } catch {
      Alert.alert('Error', 'Failed to follow/unfollow');
    }
  };

  const handleUserPress = (userId) => {
    navigation.navigate('PlayerCard', { userId });
  };

  const handleVenuePress = (venue) => {
    navigation.navigate('VenueDetail', { venueId: venue.id, venueName: venue.name });
  };

  const handleLike = async (postId) => {
    try {
      await socialAPI.toggleLike(postId);
      if (results) {
        setResults((prev) => ({
          ...prev,
          posts: (prev.posts || []).map((p) =>
            p.id === postId
              ? {
                  ...p,
                  user_liked: !p.user_liked,
                  likes_count: p.user_liked ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1,
                }
              : p
          ),
        }));
      }
    } catch {
      Alert.alert('Error', 'Failed to like post');
    }
  };

  const handleBookmark = async (postId) => {
    try {
      await socialAPI.toggleBookmark(postId);
      if (results) {
        setResults((prev) => ({
          ...prev,
          posts: (prev.posts || []).map((p) =>
            p.id === postId ? { ...p, user_bookmarked: !p.user_bookmarked } : p
          ),
        }));
      }
    } catch {
      Alert.alert('Error', 'Failed to bookmark');
    }
  };

  const handleComment = (postId) => {
    navigation.navigate('Comments', { postId });
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const hasResults =
    results &&
    ((results.people?.length || 0) + (results.posts?.length || 0) + (results.venues?.length || 0)) > 0;

  const noResultsFound = results && !hasResults && query.trim();

  const allData = [];
  if (results) {
    if ((category === 'all' || category === 'people') && results.people?.length > 0) {
      allData.push({ type: 'people', data: results.people });
    }
    if ((category === 'all' || category === 'posts') && results.posts?.length > 0) {
      allData.push({ type: 'posts', data: results.posts });
    }
    if ((category === 'all' || category === 'venues') && results.venues?.length > 0) {
      allData.push({ type: 'venues', data: results.venues });
    }
  }

  const renderSection = ({ item }) => {
    if (item.type === 'people') {
      return (
        <PeopleSection
          people={item.data}
          onFollow={handleFollow}
          onUserPress={handleUserPress}
          followingMap={followingMap}
        />
      );
    }
    if (item.type === 'posts') {
      return (
        <PostsSection
          posts={item.data}
          currentUserId={user?.id}
          onLike={handleLike}
          onBookmark={handleBookmark}
          onComment={handleComment}
          onUserPress={handleUserPress}
        />
      );
    }
    if (item.type === 'venues') {
      return <VenuesSection venues={item.data} onVenuePress={handleVenuePress} />;
    }
    return null;
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }
    if (noResultsFound) {
      return (
        <EmptyState
          icon="🔍"
          title="No results found"
          subtitle={`Nothing matched "${query}". Try a different search.`}
          style={{ marginTop: Spacing.xl2 }}
        />
      );
    }
    if (!query.trim()) {
      return (
        <View style={styles.idleContainer}>
          <Text style={{ fontSize: 56, marginBottom: Spacing.md }}>🔍</Text>
          <Text style={styles.idleTitle}>Search for people, posts, or venues</Text>
          <Text style={styles.idleSubText}>
            Discover players, check match highlights, and find the best venues near you
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>DISCOVER</Text>
        <Text style={styles.headerTitle}>Explore</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          onSubmit={() => {
            if (query.trim()) {
              setLoading(true);
              doSearch(query, category, 1, false).finally(() => setLoading(false));
            }
          }}
          placeholder="Search people, posts, venues..."
        />
      </View>

      {/* Category Tabs */}
      <TabBar tabs={CATEGORY_TABS} activeTab={category} onTabChange={handleCategoryChange} />

      {/* Results */}
      <FlatList
        data={allData}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        renderItem={renderSection}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
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
  searchContainer: {
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  listContent: {
    paddingBottom: Spacing.xl3,
  },
  loadingBox: {
    paddingTop: 80,
    alignItems: 'center',
  },

  // Result sections
  resultSection: {
    marginBottom: Spacing.lg,
  },
  resultSectionTitle: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },

  // Venue card
  venueCard: {
    marginHorizontal: Spacing.base,
    overflow: 'hidden',
  },
  venueImage: {
    width: '100%',
    height: 140,
    backgroundColor: Colors.secondary,
  },
  venuePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueContent: {
    padding: Spacing.md,
  },
  venueTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  venueName: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.amberLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Spacing.radiusFull,
  },
  ratingStar: { fontSize: 10, marginRight: 2 },
  ratingText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.amber },
  venueLocation: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginBottom: 8,
  },
  venueSports: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Idle / empty state
  idleContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  idleTitle: {
    fontSize: Typography.xl,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
    textAlign: 'center',
  },
  idleSubText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },

  // Footer
  footerLoader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
});
