import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { playerCardAPI, socialAPI, recommendationAPI, careerAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import PostCard from '../../components/common/PostCard';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

function getTierInfo(rating) {
  if (rating > 1800) return { label: 'Elite', color: Colors.tierDiamond, bg: Colors.cyanLight, emoji: '💎' };
  if (rating > 1500) return { label: 'Pro', color: Colors.tierGold, bg: Colors.amberLight, emoji: '🥇' };
  if (rating > 1200) return { label: 'Intermediate', color: Colors.tierSilver, bg: Colors.slateLight, emoji: '🥈' };
  return { label: 'Beginner', color: Colors.tierBronze, bg: Colors.orangeLight, emoji: '🥉' };
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
}

function getOverallScoreTier(score) {
  if (score >= 90) return { label: 'Elite', color: Colors.tierDiamond };
  if (score >= 75) return { label: 'Pro', color: Colors.tierGold };
  if (score >= 50) return { label: 'Intermediate', color: Colors.tierSilver };
  return { label: 'Beginner', color: Colors.tierBronze };
}

function getGradeColor(grade) {
  if (grade === 'A') return Colors.primary;
  if (grade === 'B') return Colors.sky;
  if (grade === 'C') return Colors.amber;
  return Colors.destructive;
}

export default function PlayerCardScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const userId = route.params?.userId;
  const isOwnCard = !userId || userId === user?.id;

  const [cardData, setCardData] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [career, setCareer] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const cardRes = isOwnCard
        ? await playerCardAPI.getMyCard().catch(() => ({ data: null }))
        : await playerCardAPI.getCard(userId).catch(() => ({ data: null }));
      setCardData(cardRes.data);

      if (cardRes.data?.is_following !== undefined) {
        setFollowing(cardRes.data.is_following);
      }

      const targetId = isOwnCard ? user?.id : userId;

      if (!isOwnCard && targetId) {
        const compRes = await recommendationAPI.compatibility(targetId).catch(() => ({ data: null }));
        setCompatibility(compRes.data);
      }

      if (targetId) {
        const postsRes = await socialAPI.getUserPosts(targetId, 1).catch(() => ({ data: [] }));
        const posts = Array.isArray(postsRes.data) ? postsRes.data : postsRes.data?.posts || [];
        setRecentPosts(posts.slice(0, 3));
        careerAPI.getCareer(targetId).then(r => setCareer(r.data)).catch(() => {});
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOwnCard, userId, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      await socialAPI.toggleFollow(userId);
      setFollowing(prev => !prev);
      if (cardData) {
        setCardData(prev => ({
          ...prev,
          followers_count: following
            ? (prev.followers_count || 1) - 1
            : (prev.followers_count || 0) + 1,
        }));
      }
    } catch (err) {
      // Silently fail
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      await socialAPI.toggleLike(postId);
      setRecentPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, user_liked: !p.user_liked, likes_count: p.user_liked ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1 }
          : p
      ));
    } catch (err) {
      // Silently fail
    }
  };

  const handleBookmark = async (postId) => {
    try {
      await socialAPI.toggleBookmark(postId);
      setRecentPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, user_bookmarked: !p.user_bookmarked } : p
      ));
    } catch (err) {
      // Silently fail
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const card = cardData || {};
  const rating = card.skill_rating || user?.skill_rating || 1500;
  const tier = getTierInfo(rating);
  const name = card.name || user?.name || 'Player';
  const avatarUri = card.avatar || user?.avatar;
  const totalGames = card.total_games || 0;
  const wins = card.wins || 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const reliability = card.reliability_score || card.reliability || 100;
  const postsCount = card.posts_count || 0;
  const followersCount = card.followers_count || 0;
  const followingCount = card.following_count || 0;
  const primarySport = card.primary_sport || card.preferred_sport || 'Football';
  const sportsPlayed = card.sports_played || card.sports || [];
  const achievements = card.achievements || card.badges || [];
  const memberSince = card.created_at || card.member_since || user?.created_at;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Player Card</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Avatar with gradient border */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarBorder, { borderColor: tier.color }]}>
            <Avatar uri={avatarUri} name={name} size={96} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md }}>
            <Text style={[styles.playerName, { marginTop: 0 }]}>{name}</Text>
            {card.is_verified && (
              <Ionicons name="checkmark-circle" size={22} color="#60A5FA" style={{ marginLeft: 6 }} />
            )}
          </View>

          {/* Skill Rating */}
          <View style={styles.ratingRow}>
            <Text style={[styles.ratingNumber, { color: tier.color }]}>{rating}</Text>
            <Badge
              variant={
                tier.label === 'Elite' ? 'sky' :
                tier.label === 'Pro' ? 'amber' :
                tier.label === 'Intermediate' ? 'secondary' : 'outline'
              }
              style={{ marginLeft: Spacing.sm }}
            >
              {tier.emoji} {tier.label}
            </Badge>
          </View>

          {/* Primary Sport */}
          <Badge variant="default" style={{ marginTop: Spacing.sm }}>
            {primarySport}
          </Badge>
        </View>

        {/* Social Stats */}
        <View style={styles.socialRow}>
          <View style={styles.socialStat}>
            <Text style={styles.socialValue}>{postsCount}</Text>
            <Text style={styles.socialLabel}>Posts</Text>
          </View>
          <View style={[styles.socialStat, styles.socialStatBorder]}>
            <Text style={styles.socialValue}>{followersCount}</Text>
            <Text style={styles.socialLabel}>Followers</Text>
          </View>
          <View style={styles.socialStat}>
            <Text style={styles.socialValue}>{followingCount}</Text>
            <Text style={styles.socialLabel}>Following</Text>
          </View>
        </View>

        {/* Follow + Message buttons (for other users) */}
        {!isOwnCard && (
          <View style={styles.actionRow}>
            <Button
              variant={following ? 'outline' : 'primary'}
              onPress={handleFollow}
              loading={followLoading}
              size="sm"
              style={{ flex: 1, marginRight: Spacing.sm }}
            >
              {following ? 'Following' : 'Follow'}
            </Button>
            <Button
              variant="secondary"
              onPress={() => navigation.navigate('Chat', { userId })}
              size="sm"
              style={{ flex: 1 }}
            >
              Message
            </Button>
          </View>
        )}

        {/* Overall Score */}
        {card.overall_score !== undefined && (() => {
          const scoreTier = getOverallScoreTier(card.overall_score);
          const scoreComponents = [
            { label: 'Skill', value: card.score_skill, color: Colors.primary },
            { label: 'Wins', value: card.score_wins, color: Colors.emerald },
            { label: 'Activity', value: card.score_activity, color: Colors.violet },
            { label: 'Reliability', value: card.score_reliability, color: Colors.sky },
            { label: 'Social', value: card.score_social, color: Colors.amber },
            { label: 'Sportsmanship', value: card.score_sportsmanship, color: Colors.cyan },
          ].filter(c => c.value !== undefined);
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overall Score</Text>
              <Card style={styles.overallScoreCard}>
                <View style={styles.overallScoreHeader}>
                  <Text style={[styles.overallScoreNumber, { color: scoreTier.color }]}>
                    {Math.round(card.overall_score)}
                  </Text>
                  <Badge
                    variant={scoreTier.label === 'Elite' ? 'sky' : scoreTier.label === 'Pro' ? 'amber' : 'secondary'}
                    style={{ marginLeft: Spacing.sm }}
                  >
                    {scoreTier.label}
                  </Badge>
                </View>
                {scoreComponents.length > 0 && (
                  <View style={styles.scoreBreakdown}>
                    {scoreComponents.map((comp) => (
                      <View key={comp.label} style={styles.scoreBarRow}>
                        <Text style={styles.scoreBarLabel}>{comp.label}</Text>
                        <View style={styles.scoreBarTrack}>
                          <View style={[styles.scoreBarFill, { width: `${Math.min(comp.value, 100)}%`, backgroundColor: comp.color }]} />
                        </View>
                        <Text style={styles.scoreBarValue}>{Math.round(comp.value)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </View>
          );
        })()}

        {/* Stats Grid 2x2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: Colors.violetLight }]}>
                <Text style={{ fontSize: 14 }}>🎮</Text>
              </View>
              <Text style={[styles.statValue, { color: Colors.violet }]}>{totalGames}</Text>
              <Text style={styles.statLabel}>Games</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: Colors.primaryLight }]}>
                <Text style={{ fontSize: 14 }}>🏆</Text>
              </View>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{wins}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: Colors.amberLight }]}>
                <Text style={{ fontSize: 14 }}>⭐</Text>
              </View>
              <Text style={[styles.statValue, { color: Colors.amber }]}>{winRate}%</Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: Colors.skyLight }]}>
                <Text style={{ fontSize: 14 }}>🤝</Text>
              </View>
              <Text style={[styles.statValue, { color: Colors.sky }]}>{reliability}%</Text>
              <Text style={styles.statLabel}>Reliability</Text>
            </Card>
          </View>
        </View>

        {/* Compatibility (for other users) */}
        {!isOwnCard && compatibility && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compatibility</Text>
            <Card style={styles.compatCard}>
              <View style={styles.compatRow}>
                <View style={styles.compatScoreBox}>
                  <Text style={[styles.compatScore, { color: Colors.primary }]}>
                    {compatibility.overall_score != null ? Math.round(compatibility.overall_score) : compatibility.score != null ? Math.round(compatibility.score) : '--'}%
                  </Text>
                  <Text style={styles.compatLabel}>Overall Match</Text>
                </View>
                <View style={styles.compatGradeBox}>
                  <View style={[styles.gradeCircle, { borderColor: getGradeColor(compatibility.grade || 'C') }]}>
                    <Text style={[styles.gradeText, { color: getGradeColor(compatibility.grade || 'C') }]}>
                      {compatibility.grade || 'C'}
                    </Text>
                  </View>
                  <Text style={styles.compatLabel}>Grade</Text>
                </View>
              </View>
              {compatibility.breakdown && (
                <View style={styles.breakdownList}>
                  {Object.entries(compatibility.breakdown).map(([key, val]) => (
                    <View key={key} style={styles.breakdownRow}>
                      <Text style={styles.breakdownKey}>{key.replace(/_/g, ' ')}</Text>
                      <Text style={styles.breakdownVal}>{typeof val === 'number' ? Math.round(val) : val}%</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Sports Played */}
        {sportsPlayed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sports Played</Text>
            <Card>
              {sportsPlayed.map((sport, idx) => {
                const sportName = typeof sport === 'string' ? sport : sport.name || sport.sport;
                const gameCount = typeof sport === 'object' ? sport.games || sport.count || 0 : 0;
                return (
                  <View
                    key={idx}
                    style={[styles.sportRow, idx < sportsPlayed.length - 1 && styles.sportRowBorder]}
                  >
                    <Text style={styles.sportIcon}>
                      {sportName?.toLowerCase().includes('cricket') ? '🏏' :
                       sportName?.toLowerCase().includes('badminton') ? '🏸' :
                       sportName?.toLowerCase().includes('tennis') ? '🎾' :
                       sportName?.toLowerCase().includes('basketball') ? '🏀' : '⚽'}
                    </Text>
                    <Text style={styles.sportName}>{sportName}</Text>
                    {gameCount > 0 && (
                      <Badge variant="secondary">{gameCount} games</Badge>
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* Achievement Badges */}
        {achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Card>
              <View style={styles.achievementsGrid}>
                {achievements.map((badge, idx) => {
                  const badgeEmoji = typeof badge === 'string' ? '🏅' : badge.emoji || '🏅';
                  const badgeLabel = typeof badge === 'string' ? badge : badge.label || badge.name;
                  return (
                    <View key={idx} style={styles.achievementItem}>
                      <Text style={styles.achievementEmoji}>{badgeEmoji}</Text>
                      <Text style={styles.achievementLabel} numberOfLines={2}>{badgeLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* Member Since */}
        <View style={styles.section}>
          <Card style={styles.memberCard}>
            <Text style={styles.memberIcon}>📅</Text>
            <View>
              <Text style={styles.memberLabel}>Member Since</Text>
              <Text style={styles.memberDate}>{formatDate(memberSince)}</Text>
            </View>
          </Card>
        </View>

        {/* Career & Performance */}
        {career && career.total_records > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Career & Performance</Text>
            <View style={styles.careerGrid}>
              {[
                { icon: '🏋️', label: 'Train Hrs', value: career.training_hours ?? 0, color: Colors.violet },
                { icon: '🏆', label: 'Tournaments', value: career.tournaments_played ?? 0, color: Colors.amber },
                { icon: '🏢', label: 'Orgs', value: career.organizations?.length ?? 0, color: Colors.sky },
              ].map((s, i) => (
                <Card key={i} style={styles.careerCard}>
                  <View style={[styles.statIconBox, { backgroundColor: `${s.color}18` }]}>
                    <Text style={{ fontSize: 14 }}>{s.icon}</Text>
                  </View>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </Card>
              ))}
            </View>

            {/* Recent Performance Records */}
            {career.recent_records?.length > 0 && (
              <Card style={{ marginTop: Spacing.sm }}>
                <Text style={styles.careerSubTitle}>Recent Records</Text>
                {career.recent_records.slice(0, 5).map((rec, idx) => {
                  const typeColors = { training: Colors.violet, match_result: Colors.emerald, assessment: Colors.sky, tournament_result: Colors.amber, achievement: Colors.orange };
                  const tc = typeColors[rec.record_type] || Colors.primary;
                  return (
                    <View key={rec.id || idx} style={[styles.careerRecordRow, idx < Math.min(career.recent_records.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
                      <Text style={styles.careerRecordDate}>
                        {rec.date ? new Date(rec.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '--'}
                      </Text>
                      <View style={[styles.careerTypeDot, { backgroundColor: tc }]} />
                      <Text style={styles.careerRecordTitle} numberOfLines={1}>{rec.title || rec.record_type}</Text>
                      {rec.sport && <Badge variant="outline" style={{ marginLeft: 'auto' }}>{rec.sport}</Badge>}
                    </View>
                  );
                })}
              </Card>
            )}

            {/* Organizations */}
            {career.organizations?.length > 0 && (
              <Card style={{ marginTop: Spacing.sm }}>
                <Text style={styles.careerSubTitle}>Organizations</Text>
                {career.organizations.map((org, idx) => (
                  <View key={org.id || idx} style={[styles.careerOrgRow, idx < career.organizations.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
                    <Text style={{ fontSize: 16 }}>🏢</Text>
                    <Text style={styles.careerOrgName}>{org.name}</Text>
                    {org.org_type && <Badge variant="secondary">{org.org_type.replace('_', ' ')}</Badge>}
                  </View>
                ))}
              </Card>
            )}
          </View>
        )}

        {/* Recent Posts */}
        {recentPosts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Posts</Text>
            {recentPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.id}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onUserPress={(uid) => {
                  if (uid !== (isOwnCard ? user?.id : userId)) {
                    navigation.push('PlayerCard', { userId: uid });
                  }
                }}
                style={{ marginHorizontal: 0, marginBottom: Spacing.sm }}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xl3 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  backBtn: { width: 60 },
  backText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  headerTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatarBorder: { borderWidth: 3, borderRadius: 52, padding: 3 },
  playerName: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: Spacing.md },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  ratingNumber: { fontSize: Typography.xl5, fontFamily: Typography.fontDisplayBlack },

  socialRow: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Spacing.radiusLg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.base,
  },
  socialStat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  socialStatBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  socialValue: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  socialLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },

  actionRow: { flexDirection: 'row', marginBottom: Spacing.xl },

  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.md },

  overallScoreCard: {},
  overallScoreHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  overallScoreNumber: { fontSize: Typography.xl5, fontFamily: Typography.fontDisplayBlack },
  scoreBreakdown: { gap: Spacing.sm },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scoreBarLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, width: 80 },
  scoreBarTrack: { flex: 1, height: 6, backgroundColor: Colors.secondary, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: 6, borderRadius: 3 },
  scoreBarValue: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.foreground, width: 24, textAlign: 'right' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: { width: '47.5%', padding: Spacing.md },
  statIconBox: { width: 36, height: 36, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack },
  statLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },

  compatCard: {},
  compatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  compatScoreBox: { alignItems: 'center' },
  compatScore: { fontSize: Typography.xl5, fontFamily: Typography.fontDisplayBlack },
  compatLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.xs },
  compatGradeBox: { alignItems: 'center' },
  gradeCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  gradeText: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack },
  breakdownList: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  breakdownKey: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'capitalize' },
  breakdownVal: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },

  sportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md },
  sportRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  sportIcon: { fontSize: 20 },
  sportName: { flex: 1, fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },

  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  achievementItem: { alignItems: 'center', width: 72 },
  achievementEmoji: { fontSize: 28, marginBottom: Spacing.xs },
  achievementLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textAlign: 'center' },

  memberCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  memberIcon: { fontSize: 24 },
  memberLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1 },
  memberDate: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginTop: 2 },
  careerGrid: { flexDirection: 'row', gap: Spacing.sm },
  careerCard: { flex: 1, padding: Spacing.md, alignItems: 'center' },
  careerSubTitle: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.sm },
  careerRecordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  careerRecordDate: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, width: 44 },
  careerTypeDot: { width: 8, height: 8, borderRadius: 4 },
  careerRecordTitle: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, flex: 1 },
  careerOrgRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  careerOrgName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, flex: 1 },
});
