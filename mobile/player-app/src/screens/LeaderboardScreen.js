import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { matchAPI } from '../api';
import Card from '../components/common/Card';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

function getRatingTier(r) {
  if (r >= 2500) return { label: 'Diamond', color: Colors.tierDiamond, icon: '💎' };
  if (r >= 2000) return { label: 'Gold', color: Colors.tierGold, icon: '🥇' };
  if (r >= 1500) return { label: 'Silver', color: Colors.tierSilver, icon: '🥈' };
  return { label: 'Bronze', color: Colors.tierBronze, icon: '🥉' };
}

const SPORTS = ['all', 'Football', 'Cricket', 'Basketball', 'Badminton', 'Tennis'];

export default function LeaderboardScreen() {
  const navigation = useNavigation();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSport, setSelectedSport] = useState('all');

  const loadLeaderboard = async () => {
    try {
      const params = selectedSport !== 'all' ? { sport: selectedSport } : {};
      const res = await matchAPI.leaderboard(params);
      setLeaderboard(res.data || []);
    } catch (err) {
      setLeaderboard([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadLeaderboard();
  }, [selectedSport]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboard();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>GLOBAL</Text>
        <Text style={styles.headerTitle}>Leaderboard</Text>
      </View>

      {/* Sport Filter */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}
      >
        {SPORTS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, selectedSport === s && styles.chipActive]}
            onPress={() => setSelectedSport(s)}
          >
            <Text style={[styles.chipText, selectedSport === s && styles.chipTextActive]}>
              {s === 'all' ? 'All Sports' : s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 48 }}>🏆</Text>
          <Text style={styles.emptyText}>No players ranked yet</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* Top 3 podium */}
          {leaderboard.length >= 3 && (
            <View style={styles.podium}>
              {/* 2nd place */}
              <PodiumCard player={leaderboard[1]} rank={2} />
              {/* 1st place */}
              <PodiumCard player={leaderboard[0]} rank={1} />
              {/* 3rd place */}
              <PodiumCard player={leaderboard[2]} rank={3} />
            </View>
          )}

          {/* Rest of leaderboard */}
          <View style={{ gap: Spacing.sm }}>
            {leaderboard.slice(3).map((player, idx) => (
              <LeaderRow key={player.id} player={player} rank={idx + 4} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PodiumCard({ player, rank }) {
  const tier = getRatingTier(player?.skill_rating || 1500);
  const isFirst = rank === 1;
  const height = rank === 1 ? 100 : rank === 2 ? 75 : 60;

  return (
    <View style={[styles.podiumItem, isFirst && { marginTop: -20 }]}>
      {isFirst && <Text style={styles.crownEmoji}>👑</Text>}
      {player?.avatar ? (
        <Image source={{ uri: player.avatar }} style={[styles.podiumAvatar, isFirst && styles.podiumAvatarLarge]} />
      ) : (
        <View style={[styles.podiumAvatarPlaceholder, isFirst && styles.podiumAvatarLarge, { borderColor: tier.color }]}>
          <Text style={{ fontSize: isFirst ? 24 : 18, color: tier.color }}>
            {player?.name?.charAt(0)?.toUpperCase() || 'P'}
          </Text>
        </View>
      )}
      <Text style={[styles.podiumName, isFirst && { fontSize: Typography.sm }]} numberOfLines={1}>
        {player?.name?.split(' ')[0] || 'Player'}
      </Text>
      <Text style={[styles.podiumRating, { color: tier.color }]}>{player?.skill_rating || 1500}</Text>
      <View style={[styles.podiumBase, { height, backgroundColor: rank === 1 ? Colors.amberLight : Colors.secondary }]}>
        <Text style={[styles.podiumRank, { color: rank === 1 ? Colors.amber : Colors.mutedForeground }]}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
        </Text>
      </View>
    </View>
  );
}

function LeaderRow({ player, rank }) {
  const tier = getRatingTier(player?.skill_rating || 1500);
  const winRate = player?.total_games ? Math.round(((player?.wins || 0) / player.total_games) * 100) : 0;

  return (
    <Card style={styles.leaderRow}>
      <Text style={styles.leaderRank}>#{rank}</Text>
      {player?.avatar ? (
        <Image source={{ uri: player.avatar }} style={styles.leaderAvatar} />
      ) : (
        <View style={[styles.leaderAvatarPlaceholder, { borderColor: tier.color }]}>
          <Text style={{ color: tier.color, fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack }}>
            {player?.name?.charAt(0)?.toUpperCase() || 'P'}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.leaderName}>{player?.name || 'Player'}</Text>
        <Text style={[styles.leaderTier, { color: tier.color }]}>{tier.icon} {tier.label}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.leaderRating, { color: tier.color }]}>{player?.skill_rating || 1500}</Text>
        <Text style={styles.leaderWinRate}>{winRate}% WR</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: Typography.widest },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },
  filterScroll: { flexGrow: 0 },
  filterContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  chipTextActive: { color: Colors.primary },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: Spacing.xl2, paddingTop: Spacing.xl2, gap: Spacing.sm },
  podiumItem: { flex: 1, alignItems: 'center' },
  crownEmoji: { fontSize: 24, marginBottom: 4 },
  podiumAvatar: { width: 56, height: 56, borderRadius: 28, marginBottom: 6, borderWidth: 2, borderColor: Colors.amber },
  podiumAvatarLarge: { width: 72, height: 72, borderRadius: 36 },
  podiumAvatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderWidth: 2 },
  podiumName: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.foreground, textAlign: 'center', maxWidth: 80 },
  podiumRating: { fontSize: Typography.sm, fontFamily: Typography.fontDisplayBlack, marginBottom: 6 },
  podiumBase: { width: '100%', borderRadius: `${Spacing.radiusMd}px ${Spacing.radiusMd}px 0 0`, justifyContent: 'center', alignItems: 'center', borderTopLeftRadius: Spacing.radiusMd, borderTopRightRadius: Spacing.radiusMd },
  podiumRank: { fontSize: 18, paddingTop: 8 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  leaderRank: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground, width: 24, textAlign: 'center' },
  leaderAvatar: { width: 40, height: 40, borderRadius: 20 },
  leaderAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  leaderName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  leaderTier: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold },
  leaderRating: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack },
  leaderWinRate: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
});
