import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { ratingAPI, authAPI } from '../api';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

const { width: SCREEN_W } = Dimensions.get('window');

function getRatingTier(r) {
  if (r >= 2500) return { label: 'Diamond', color: Colors.tierDiamond, icon: '💎' };
  if (r >= 2000) return { label: 'Gold', color: Colors.tierGold, icon: '🥇' };
  if (r >= 1500) return { label: 'Silver', color: Colors.tierSilver, icon: '🥈' };
  return { label: 'Bronze', color: Colors.tierBronze, icon: '🥉' };
}

// Simple SVG-free rating chart using View components
function RatingChart({ timeline }) {
  if (!timeline || timeline.length < 2) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyChartText}>No match history yet</Text>
      </View>
    );
  }

  const ratings = timeline.map(t => t.rating);
  const minR = Math.min(...ratings) - 50;
  const maxR = Math.max(...ratings) + 50;
  const range = maxR - minR || 1;
  const chartW = SCREEN_W - Spacing.base * 4;
  const chartH = 120;
  const padX = 20;
  const padY = 10;
  const drawW = chartW - padX * 2;
  const drawH = chartH - padY * 2;

  // Calculate points
  const points = timeline.map((t, i) => ({
    x: padX + (i / Math.max(timeline.length - 1, 1)) * drawW,
    y: padY + drawH - ((t.rating - minR) / range) * drawH,
    rating: t.rating,
    delta: t.delta,
  }));

  return (
    <View style={[styles.chart, { height: chartH }]}>
      {/* Y axis labels */}
      <Text style={[styles.chartLabel, { top: padY, left: 0 }]}>{maxR}</Text>
      <Text style={[styles.chartLabel, { top: chartH / 2, left: 0 }]}>{Math.round((maxR + minR) / 2)}</Text>
      <Text style={[styles.chartLabel, { bottom: padY, left: 0 }]}>{minR}</Text>

      {/* Line segments */}
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const isUp = next.delta >= 0;
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View key={i} style={{
            position: 'absolute',
            left: p.x + padX,
            top: p.y,
            width: length,
            height: 2,
            backgroundColor: isUp ? Colors.primary : Colors.destructive,
            transformOrigin: 'left center',
            transform: [{ rotate: `${angle}deg` }],
          }} />
        );
      })}

      {/* Dots */}
      {points.map((p, i) => {
        const color = p.delta > 0 ? Colors.primary : p.delta < 0 ? Colors.destructive : Colors.slate;
        return (
          <View key={i} style={[styles.chartDot, { left: p.x + padX - 4, top: p.y - 4, backgroundColor: color }]} />
        );
      })}

      {/* Latest rating indicator */}
      {points.length > 0 && (
        <View style={[styles.chartLatest, { left: points[points.length - 1].x + padX - 20 }]}>
          <Text style={[styles.chartLatestText, { color: points[points.length - 1].delta >= 0 ? Colors.primary : Colors.destructive }]}>
            {points[points.length - 1].rating}
          </Text>
        </View>
      )}
    </View>
  );
}

function RecordRow({ record }) {
  const [expanded, setExpanded] = useState(false);
  const isWin = record.result === 'win';
  const isLoss = record.result === 'loss';
  const resultColor = isWin ? Colors.primary : isLoss ? Colors.destructive : Colors.slate;
  const resultBg = isWin ? Colors.primaryLight : isLoss ? Colors.destructiveLight : Colors.slateLight;

  return (
    <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.75}>
      <View style={styles.recordRow}>
        <View style={styles.recordLeft}>
          <Text style={styles.recordSeq}>#{record.seq}</Text>
          <View style={[styles.resultIcon, { backgroundColor: resultBg }]}>
            <Text style={[styles.resultLetter, { color: resultColor }]}>
              {isWin ? 'W' : isLoss ? 'L' : 'D'}
            </Text>
          </View>
        </View>
        <View style={styles.recordMid}>
          <View style={styles.recordTitleRow}>
            <Text style={styles.recordOpponent} numberOfLines={1}>
              vs {record.opponent_snapshot?.[0]?.name || 'Unknown'}
              {record.opponent_snapshot?.length > 1 ? ` +${record.opponent_snapshot.length - 1}` : ''}
            </Text>
            <Badge variant="secondary" style={{ marginLeft: 4 }}>{record.sport}</Badge>
          </View>
          <Text style={styles.recordDate}>{record.match_date}</Text>
        </View>
        <View style={styles.recordRight}>
          <Text style={[styles.recordDelta, { color: resultColor }]}>
            {record.delta > 0 ? '+' : ''}{record.delta}
          </Text>
          <Text style={styles.recordRatingChange}>{record.previous_rating}→{record.new_rating}</Text>
        </View>
        <Text style={{ color: Colors.mutedForeground, marginLeft: 4 }}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {expanded && (
        <View style={styles.recordExpanded}>
          <View style={styles.expandedGrid}>
            {[
              { label: 'Rating Change', value: `${record.previous_rating} → ${record.new_rating}` },
              { label: 'RD Change', value: `${record.previous_rd?.toFixed(0)} → ${record.new_rd?.toFixed(0)}` },
              { label: 'Team', value: `Team ${record.team?.toUpperCase()}` },
              { label: 'Match ID', value: record.match_id?.slice(0, 12) + '...' },
            ].map((item, i) => (
              <View key={i} style={styles.expandedItem}>
                <Text style={styles.expandedLabel}>{item.label}</Text>
                <Text style={styles.expandedValue}>{item.value}</Text>
              </View>
            ))}
          </View>
          {record.opponent_snapshot?.length > 0 && (
            <View style={styles.opponentsBox}>
              <Text style={styles.opponentsTitle}>Opponents</Text>
              <View style={styles.opponentsList}>
                {record.opponent_snapshot.map((o, i) => (
                  <View key={i} style={styles.opponentChip}>
                    <Text style={styles.opponentName}>{o.name}</Text>
                    <Text style={styles.opponentRating}>({o.rating_at_time})</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.hashBox}>
            <Text style={styles.hashIcon}>🔐</Text>
            <Text style={styles.hashText} numberOfLines={1}>SHA-256: {record.record_hash}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function RatingProfileScreen() {
  const route = useRoute();
  const { userId, userName } = route.params || {};
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const targetId = userId;
      if (!targetId) { setLoading(false); return; }
      const [histRes, profileRes] = await Promise.all([
        ratingAPI.history(targetId, 50).catch(() => ({ data: { timeline: [], records: [], verification: null } })),
        authAPI.getMe().catch(() => ({ data: null })),
      ]);
      const data = histRes.data || {};
      setHistory(data.records || []);
      setVerification(data.verification);
      if (profileRes.data) setProfile(profileRes.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [userId]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const tier = getRatingTier(profile?.skill_rating || 1500);
  const winRate = profile?.total_games ? Math.round(((profile?.wins || 0) / profile.total_games) * 100) : 0;
  const timeline = history.map(r => ({ rating: r.new_rating, delta: r.delta })).reverse();

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.profileHeader}>
          {profile?.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { borderColor: tier.color }]}>
              <Text style={[styles.avatarInitial, { color: tier.color }]}>
                {(profile?.name || userName || 'P').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.profileName}>{profile?.name || userName || 'Player'}</Text>

          {/* Verification Badge */}
          {verification && (
            <View style={[styles.verBadge, {
              backgroundColor: verification.verified ? Colors.primaryLight : Colors.destructiveLight,
              borderColor: verification.verified ? Colors.primary : Colors.destructive,
            }]}>
              <Text style={{ color: verification.verified ? Colors.primary : Colors.destructive, fontSize: 14 }}>
                {verification.verified ? '🛡️ Verified Rating' : '⚠️ Chain Broken'}
              </Text>
            </View>
          )}
        </View>

        {/* Rating Big Display */}
        <View style={styles.ratingHero}>
          <View style={styles.ratingBig}>
            <Text style={styles.tierIcon}>{tier.icon}</Text>
            <Text style={[styles.ratingScore, { color: tier.color }]}>{profile?.skill_rating || 1500}</Text>
            <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
          </View>
          <View style={styles.statsRow}>
            {[
              { label: 'Games', value: profile?.total_games || 0, color: Colors.violet },
              { label: 'Wins', value: profile?.wins || 0, color: Colors.primary },
              { label: 'Win Rate', value: `${winRate}%`, color: Colors.amber },
            ].map((s, i) => (
              <View key={i} style={[styles.statBox, i < 2 && { borderRightWidth: 1, borderRightColor: Colors.border }]}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Rating Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rating History</Text>
          <Card style={{ overflow: 'hidden', padding: Spacing.md }}>
            <RatingChart timeline={timeline} />
          </Card>
        </View>

        {/* Match History */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Records</Text>
            <Card padding={false}>
              {history.map((record, i) => (
                <View key={record.record_hash || i} style={i < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                  <RecordRow record={record} />
                </View>
              ))}
            </Card>
          </View>
        )}

        {history.length === 0 && (
          <View style={styles.emptyHistory}>
            <Text style={{ fontSize: 40 }}>🏆</Text>
            <Text style={styles.emptyHistoryText}>No match history yet</Text>
            <Text style={styles.emptyHistorySubText}>Play some games to build your rating profile</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  profileHeader: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.md, paddingHorizontal: Spacing.base },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: Colors.primary, marginBottom: Spacing.md },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, marginBottom: Spacing.md },
  avatarInitial: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack },
  profileName: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.sm },
  verBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Spacing.radiusFull, borderWidth: 1, gap: 6 },
  ratingHero: { marginHorizontal: Spacing.base, backgroundColor: Colors.card, borderRadius: Spacing.radiusLg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.base },
  ratingBig: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  tierIcon: { fontSize: 28 },
  ratingScore: { fontSize: Typography.xl5, fontFamily: Typography.fontDisplayBlack },
  tierLabel: { fontSize: Typography.lg, fontFamily: Typography.fontBodyBold },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statValue: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack },
  statLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.md },
  chart: { position: 'relative', marginTop: Spacing.sm },
  chartLabel: { position: 'absolute', fontSize: 8, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  chartDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  chartLatest: { position: 'absolute', bottom: 0 },
  chartLatestText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold },
  emptyChart: { height: 80, justifyContent: 'center', alignItems: 'center' },
  emptyChartText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  recordRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm },
  recordLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recordSeq: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, width: 22 },
  resultIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  resultLetter: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold },
  recordMid: { flex: 1 },
  recordTitleRow: { flexDirection: 'row', alignItems: 'center' },
  recordOpponent: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, flex: 1 },
  recordDate: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  recordRight: { alignItems: 'flex-end' },
  recordDelta: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack },
  recordRatingChange: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  recordExpanded: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.md },
  expandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  expandedItem: { width: '47%', backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, padding: Spacing.sm },
  expandedLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginBottom: 2 },
  expandedValue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  opponentsBox: { gap: 6 },
  opponentsTitle: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5 },
  opponentsList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  opponentChip: { backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, paddingHorizontal: Spacing.sm, paddingVertical: 4, flexDirection: 'row', gap: 4, alignItems: 'center' },
  opponentName: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  opponentRating: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  hashBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  hashIcon: { fontSize: 12 },
  hashText: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, flex: 1 },
  emptyHistory: { alignItems: 'center', paddingVertical: Spacing.xl2, paddingHorizontal: Spacing.base, gap: Spacing.sm },
  emptyHistoryText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  emptyHistorySubText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textAlign: 'center' },
});
