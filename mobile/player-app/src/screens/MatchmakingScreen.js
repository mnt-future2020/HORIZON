import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { matchAPI, mercenaryAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

const TABS = ['browse', 'my_matches', 'mercenary'];
const SPORTS = ['Football', 'Cricket', 'Basketball', 'Badminton', 'Tennis', 'Volleyball'];

function MatchCard({ match, userId, onJoin }) {
  const isCreator = match.creator_id === userId;
  const hasJoined = match.players_joined?.includes(userId);
  const spotsLeft = match.players_needed - (match.players_joined?.length || 0);
  const hasResult = !!match.result;
  const resultConfirmed = match.result?.confirmed;

  const compatColor = match.compatibility_score >= 80 ? Colors.primary
    : match.compatibility_score >= 50 ? Colors.amber : Colors.destructive;

  return (
    <Card style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.matchTitleRow}>
            <Text style={styles.matchSport}>{match.sport?.replace('_', ' ')}</Text>
            <Badge variant={match.status === 'open' ? 'default' : 'secondary'} style={{ marginLeft: 6 }}>
              {match.status}
            </Badge>
            {match.compatibility_score != null && (
              <View style={[styles.compatBadge, { backgroundColor: `${compatColor}20`, borderColor: `${compatColor}40` }]}>
                <Text style={[styles.compatText, { color: compatColor }]}>
                  ⚡ {match.compatibility_score}% match
                </Text>
              </View>
            )}
          </View>
          {match.description ? (
            <Text style={styles.matchDesc} numberOfLines={2}>{match.description}</Text>
          ) : null}
        </View>
        <View style={[styles.spotsBadge, { backgroundColor: spotsLeft > 0 ? Colors.primaryLight : Colors.secondary }]}>
          <Text style={[styles.spotsText, { color: spotsLeft > 0 ? Colors.primary : Colors.mutedForeground }]}>
            {spotsLeft > 0 ? `${spotsLeft} spots` : 'Full'}
          </Text>
        </View>
      </View>

      <View style={styles.matchMeta}>
        {[
          { icon: '🕐', text: `${match.date} at ${match.time}` },
          { icon: '📍', text: match.venue_name || 'TBD' },
          { icon: '🏆', text: `${match.min_skill}–${match.max_skill}` },
          { icon: '👥', text: `${match.players_joined?.length || 0}/${match.players_needed}` },
        ].map((m, i) => (
          <Text key={i} style={styles.matchMetaItem}>{m.icon} {m.text}</Text>
        ))}
      </View>

      {hasResult && (
        <View style={[styles.resultBox, { backgroundColor: resultConfirmed ? Colors.primaryLight : Colors.amberLight }]}>
          <Text style={[styles.resultText, { color: resultConfirmed ? Colors.primary : Colors.amber }]}>
            {resultConfirmed ? '✅ Result Confirmed' : '⏳ Result Pending'}
            {' — '}Winner: {match.result.winner === 'draw' ? 'Draw' : match.result.winner === 'team_a' ? 'Team A' : 'Team B'}
            {match.result.score_a != null ? ` (${match.result.score_a}–${match.result.score_b})` : ''}
          </Text>
        </View>
      )}

      <View style={styles.matchFooter}>
        <Text style={styles.creatorText}>by <Text style={{ color: Colors.foreground }}>{match.creator_name}</Text></Text>
        {!isCreator && !hasJoined && spotsLeft > 0 && match.status === 'open' && (
          <Button size="sm" onPress={() => onJoin(match.id)}>Join</Button>
        )}
        {hasJoined && !hasResult && <Badge variant="default">Joined ✓</Badge>}
      </View>
    </Card>
  );
}

function MercenaryCard({ post, userId, onApply }) {
  const isHost = post.host_id === userId;
  const hasApplied = post.applicants?.some(a => a.id === userId);
  const isAccepted = post.accepted?.some(a => a.id === userId);
  const spotsLeft = post.spots_available - (post.spots_filled || 0);

  return (
    <Card style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mercTitle}>🎯 {post.position_needed}</Text>
          <Text style={styles.matchDesc}>📍 {post.venue_name} • {post.sport}</Text>
          {post.description ? <Text style={[styles.matchDesc, { marginTop: 4 }]}>{post.description}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.mercAmount, { color: Colors.violet }]}>₹{post.amount_per_player}</Text>
          <Text style={styles.mercSpots}>{spotsLeft}/{post.spots_available} open</Text>
        </View>
      </View>

      <View style={styles.matchMeta}>
        <Text style={styles.matchMetaItem}>🕐 {post.date} at {post.time}</Text>
        <Text style={styles.matchMetaItem}>by {post.host_name}</Text>
      </View>

      <View style={styles.matchFooter}>
        <View />
        {!isHost && !hasApplied && !isAccepted && post.status === 'open' && (
          <Button size="sm" variant="secondary" onPress={() => onApply(post.id)}
            style={{ backgroundColor: Colors.violetLight, borderColor: Colors.violet }}
            textStyle={{ color: Colors.violet }}>
            Apply
          </Button>
        )}
        {hasApplied && !isAccepted && <Badge variant="violet">Applied — Waiting</Badge>}
        {isAccepted && <Badge variant="default">Accepted ✓</Badge>}
      </View>
    </Card>
  );
}

function CreateMatchModal({ visible, onClose, onCreate }) {
  const [form, setForm] = useState({ sport: 'Football', description: '', date: '', time: '', players_needed: '10', min_skill: '1000', max_skill: '2500' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!form.date || !form.time) { Alert.alert('Error', 'Please fill date and time'); return; }
    setLoading(true);
    try {
      await matchAPI.create({ ...form, players_needed: parseInt(form.players_needed), min_skill: parseInt(form.min_skill), max_skill: parseInt(form.max_skill) });
      onCreate();
      onClose();
      setForm({ sport: 'Football', description: '', date: '', time: '', players_needed: '10', min_skill: '1000', max_skill: '2500' });
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Match</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: Colors.mutedForeground, fontSize: 20 }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Sport</Text>
            <View style={styles.sportGrid}>
              {SPORTS.map(s => (
                <TouchableOpacity key={s} style={[styles.sportChip, form.sport === s && styles.sportChipActive]} onPress={() => setForm(p => ({ ...p, sport: s }))}>
                  <Text style={[styles.sportChipText, form.sport === s && { color: Colors.primary }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Description" value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="e.g. Weekend 5v5 friendly" autoCapitalize="sentences" />
            <Input label="Date (YYYY-MM-DD)" value={form.date} onChangeText={v => setForm(p => ({ ...p, date: v }))} placeholder="2024-12-25" />
            <Input label="Time (HH:MM)" value={form.time} onChangeText={v => setForm(p => ({ ...p, time: v }))} placeholder="18:00" />
            <Input label="Players Needed" value={form.players_needed} onChangeText={v => setForm(p => ({ ...p, players_needed: v }))} keyboardType="numeric" />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input label="Min Rating" value={form.min_skill} onChangeText={v => setForm(p => ({ ...p, min_skill: v }))} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Max Rating" value={form.max_skill} onChangeText={v => setForm(p => ({ ...p, max_skill: v }))} keyboardType="numeric" />
              </View>
            </View>
            <Button onPress={handleCreate} loading={loading} style={{ marginTop: Spacing.sm }}>Create Match</Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function MatchmakingScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('browse');
  const [matches, setMatches] = useState([]);
  const [myMatches, setMyMatches] = useState([]);
  const [mercenary, setMercenary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSport, setSelectedSport] = useState('all');
  const [createVisible, setCreateVisible] = useState(false);

  const loadData = async () => {
    try {
      const [allRes, recRes, mercRes] = await Promise.all([
        matchAPI.list(selectedSport !== 'all' ? { sport: selectedSport } : {}).catch(() => ({ data: [] })),
        matchAPI.recommended().catch(() => ({ data: [] })),
        mercenaryAPI.list().catch(() => ({ data: [] })),
      ]);
      const allMatches = allRes.data || [];
      setMatches(allMatches);
      setMyMatches(allMatches.filter(m => m.creator_id === user?.id || m.players_joined?.includes(user?.id)));
      setMercenary(mercRes.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedSport]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleJoin = async (id) => {
    try {
      await matchAPI.join(id);
      Alert.alert('Success', 'You have joined the match!');
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to join');
    }
  };

  const handleApply = async (id) => {
    try {
      await mercenaryAPI.apply(id);
      Alert.alert('Applied!', 'Your application has been sent to the host.');
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to apply');
    }
  };

  const currentList = activeTab === 'browse' ? matches : activeTab === 'my_matches' ? myMatches : mercenary;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>FIND A</Text>
          <Text style={styles.headerTitle}>Game</Text>
        </View>
        <Button size="sm" onPress={() => setCreateVisible(true)}>+ Create</Button>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[{ key: 'browse', label: 'Browse' }, { key: 'my_matches', label: 'My Matches' }, { key: 'mercenary', label: 'Sub Player' }].map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sport Filter (browse only) */}
      {activeTab === 'browse' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {['all', ...SPORTS].map(s => (
            <TouchableOpacity key={s} style={[styles.chip, selectedSport === s && styles.chipActive]} onPress={() => setSelectedSport(s)}>
              <Text style={[styles.chipText, selectedSport === s && styles.chipTextActive]}>{s === 'all' ? 'All Sports' : s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {currentList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 48 }}>⚔️</Text>
              <Text style={styles.emptyText}>No {activeTab === 'mercenary' ? 'sub player posts' : 'matches'} found</Text>
              {activeTab === 'browse' && (
                <Button onPress={() => setCreateVisible(true)} style={{ marginTop: Spacing.md }}>Create a Match</Button>
              )}
            </View>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {activeTab === 'mercenary'
                ? currentList.map(p => <MercenaryCard key={p.id} post={p} userId={user?.id} onApply={handleApply} />)
                : currentList.map(m => <MatchCard key={m.id} match={m} userId={user?.id} onJoin={handleJoin} />)
              }
            </View>
          )}
        </ScrollView>
      )}

      <CreateMatchModal visible={createVisible} onClose={() => setCreateVisible(false)} onCreate={loadData} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: Typography.widest },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  tabBar: { flexDirection: 'row', marginHorizontal: Spacing.base, backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, padding: 3, marginBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Spacing.radiusSm },
  tabActive: { backgroundColor: Colors.card },
  tabText: { fontSize: 10, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground, textTransform: 'uppercase' },
  tabTextActive: { color: Colors.foreground },
  filterScroll: { flexGrow: 0 },
  filterContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  chipTextActive: { color: Colors.primary },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  matchCard: { padding: Spacing.md, marginBottom: 0 },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  matchTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  matchSport: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, textTransform: 'capitalize' },
  matchDesc: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  compatBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Spacing.radiusFull, borderWidth: 1 },
  compatText: { fontSize: 9, fontFamily: Typography.fontBodyBold },
  spotsBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Spacing.radiusFull, marginLeft: Spacing.sm },
  spotsText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold },
  matchMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  matchMetaItem: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  resultBox: { borderRadius: Spacing.radiusMd, padding: Spacing.sm, marginBottom: Spacing.sm },
  resultText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold },
  matchFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  creatorText: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  mercTitle: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginBottom: 4 },
  mercAmount: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack },
  mercSpots: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  label: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 2, marginBottom: Spacing.sm },
  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  sportChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.secondary },
  sportChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  sportChipText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.card, borderTopLeftRadius: Spacing.radius2xl, borderTopRightRadius: Spacing.radius2xl, padding: Spacing.xl, maxHeight: '90%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
});
