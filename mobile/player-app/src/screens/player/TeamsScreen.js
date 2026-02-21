import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { teamAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SearchBar from '../../components/common/SearchBar';
import FilterChips from '../../components/common/FilterChips';
import EmptyState from '../../components/common/EmptyState';
import TabBar from '../../components/common/TabBar';
import ModalSheet from '../../components/common/ModalSheet';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'find', label: 'Find Teams' },
  { key: 'my', label: 'My Teams' },
];

const SPORT_FILTERS = [
  { key: 'All', label: 'All' },
  { key: 'Football', label: 'Football' },
  { key: 'Cricket', label: 'Cricket' },
  { key: 'Basketball', label: 'Basketball' },
  { key: 'Badminton', label: 'Badminton' },
  { key: 'Tennis', label: 'Tennis' },
];

const SPORT_OPTIONS = ['Football', 'Cricket', 'Basketball', 'Badminton', 'Tennis', 'Volleyball'];

function TeamCard({ team, userId, onJoin, onLeave }) {
  const isCaptain = team.captain_id === userId;
  const isMember = team.members?.some(m => m.id === userId || m === userId);
  const playerCount = team.member_count || team.members?.length || 0;

  return (
    <Card style={styles.teamCard}>
      <View style={styles.teamHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.teamName}>{team.name}</Text>
          <Badge
            variant={team.sport === 'Football' ? 'default' : team.sport === 'Cricket' ? 'amber' : 'violet'}
            style={{ marginTop: Spacing.xs }}
          >
            {team.sport}
          </Badge>
        </View>
        <View style={styles.playerCountBox}>
          <Text style={styles.playerCountNum}>{playerCount}</Text>
          <Text style={styles.playerCountMax}>/{team.max_players || '--'}</Text>
        </View>
      </View>

      {team.description ? (
        <Text style={styles.teamDesc} numberOfLines={2}>{team.description}</Text>
      ) : null}

      <View style={styles.teamMeta}>
        <Text style={styles.metaItem}>
          Captain: <Text style={{ color: Colors.foreground }}>{team.captain_name || 'Unknown'}</Text>
        </Text>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'W', value: team.wins || 0, color: Colors.primary },
          { label: 'L', value: team.losses || 0, color: Colors.destructive },
          { label: 'D', value: team.draws || 0, color: Colors.mutedForeground },
        ].map((s) => (
          <View key={s.label} style={styles.statItem}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.teamFooter}>
        <View />
        {isCaptain ? (
          <Badge variant="default">Captain</Badge>
        ) : isMember ? (
          <Button size="sm" variant="destructive" onPress={() => onLeave(team.id)}>Leave</Button>
        ) : (
          <Button size="sm" onPress={() => onJoin(team.id)}>Join</Button>
        )}
      </View>
    </Card>
  );
}

export default function TeamsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('find');
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState('All');
  const [teams, setTeams] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    sport: 'Football',
    max_players: '10',
  });

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedSport !== 'All') params.sport = selectedSport;

      const [findRes, myRes] = await Promise.all([
        teamAPI.list(params).catch(() => ({ data: [] })),
        teamAPI.myTeams().catch(() => ({ data: [] })),
      ]);
      setTeams(findRes.data || []);
      setMyTeams(myRes.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedSport]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [selectedSport]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearch = () => {
    setLoading(true);
    loadData();
  };

  const handleJoin = async (id) => {
    try {
      await teamAPI.join(id);
      Alert.alert('Success', 'You have joined the team!');
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to join team');
    }
  };

  const handleLeave = async (id) => {
    Alert.alert('Leave Team', 'Are you sure you want to leave this team?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await teamAPI.leave(id);
            Alert.alert('Done', 'You have left the team.');
            loadData();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to leave team');
          }
        },
      },
    ]);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter a team name');
      return;
    }
    setCreateLoading(true);
    try {
      await teamAPI.create({
        name: form.name.trim(),
        description: form.description.trim(),
        sport: form.sport,
        max_players: parseInt(form.max_players) || 10,
      });
      Alert.alert('Success', 'Team created successfully!');
      setCreateVisible(false);
      setForm({ name: '', description: '', sport: 'Football', max_players: '10' });
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create team');
    } finally {
      setCreateLoading(false);
    }
  };

  const currentList = activeTab === 'find' ? teams : myTeams;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>MANAGE</Text>
          <Text style={styles.headerTitle}>Teams</Text>
        </View>
        <Button size="sm" onPress={() => setCreateVisible(true)}>+ Create</Button>
      </View>

      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'find' && (
        <>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onSubmit={handleSearch}
            placeholder="Search teams..."
            style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.sm }}
          />
          <FilterChips
            items={SPORT_FILTERS}
            selected={selectedSport}
            onSelect={setSelectedSport}
            style={{ marginBottom: Spacing.sm }}
          />
        </>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TeamCard
              team={item}
              userId={user?.id}
              onJoin={handleJoin}
              onLeave={handleLeave}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={() => (
            <EmptyState
              icon={activeTab === 'find' ? '🏟️' : '👥'}
              title={activeTab === 'find' ? 'No teams found' : 'No teams yet'}
              subtitle={activeTab === 'find' ? 'Try adjusting your search or filters' : 'Join or create a team to get started'}
              actionLabel={activeTab === 'my' ? 'Create Team' : undefined}
              onAction={activeTab === 'my' ? () => setCreateVisible(true) : undefined}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreateVisible(true)} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create Team Modal */}
      <ModalSheet visible={createVisible} onClose={() => setCreateVisible(false)} title="Create Team">
        <Input
          label="Team Name"
          value={form.name}
          onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
          placeholder="Enter team name"
          autoCapitalize="words"
        />
        <Input
          label="Description"
          value={form.description}
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          placeholder="Brief team description"
          autoCapitalize="sentences"
          multiline
        />
        <Text style={styles.label}>Sport</Text>
        <View style={styles.sportGrid}>
          {SPORT_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sportChip, form.sport === s && styles.sportChipActive]}
              onPress={() => setForm((p) => ({ ...p, sport: s }))}
            >
              <Text style={[styles.sportChipText, form.sport === s && { color: Colors.primary }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input
          label="Max Players"
          value={form.max_players}
          onChangeText={(v) => setForm((p) => ({ ...p, max_players: v }))}
          placeholder="10"
          keyboardType="numeric"
        />
        <Button onPress={handleCreate} loading={createLoading} style={{ marginTop: Spacing.sm }}>
          Create Team
        </Button>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  teamCard: { padding: Spacing.md, marginBottom: Spacing.md },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  teamName: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  playerCountBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radiusFull,
  },
  playerCountNum: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
  },
  playerCountMax: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  teamDesc: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginBottom: Spacing.sm,
  },
  teamMeta: {
    marginBottom: Spacing.sm,
  },
  metaItem: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.lg,
    fontFamily: Typography.fontDisplayBlack,
  },
  statLabel: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
  },
  teamFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl2,
    right: Spacing.xl,
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
  fabText: {
    fontSize: 28,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.primaryForeground,
    marginTop: -2,
  },
  label: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sportChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusFull,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.secondary,
  },
  sportChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  sportChipText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
  },
});
