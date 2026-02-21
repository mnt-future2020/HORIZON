import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { tournamentAPI, venueAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SearchBar from '../../components/common/SearchBar';
import FilterChips from '../../components/common/FilterChips';
import EmptyState from '../../components/common/EmptyState';
import ModalSheet from '../../components/common/ModalSheet';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const SPORT_FILTERS = [
  { key: 'All', label: 'All' },
  { key: 'Football', label: 'Football' },
  { key: 'Cricket', label: 'Cricket' },
  { key: 'Basketball', label: 'Basketball' },
  { key: 'Badminton', label: 'Badminton' },
  { key: 'Tennis', label: 'Tennis' },
];

const STATUS_FILTERS = [
  { key: 'All', label: 'All' },
  { key: 'registration_open', label: 'Registration Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

const FORMAT_LABELS = {
  knockout: 'Knockout',
  round_robin: 'Round Robin',
  league: 'League',
};

const FORMAT_OPTIONS = ['knockout', 'round_robin', 'league'];
const SPORT_OPTIONS = ['Football', 'Cricket', 'Basketball', 'Badminton', 'Tennis', 'Volleyball'];

function getStatusBadgeVariant(status) {
  switch (status) {
    case 'registration_open': return 'default';
    case 'in_progress': return 'amber';
    case 'completed': return 'secondary';
    case 'cancelled': return 'destructive';
    default: return 'outline';
  }
}

function getFormatBadgeVariant(format) {
  switch (format) {
    case 'knockout': return 'destructive';
    case 'round_robin': return 'violet';
    case 'league': return 'sky';
    default: return 'secondary';
  }
}

function TournamentCard({ tournament, onRegister, onPress }) {
  const participantCount = tournament.participant_count || tournament.participants?.length || 0;
  const statusLabel = tournament.status?.replace(/_/g, ' ') || tournament.status;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <Card style={styles.tournamentCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tournamentName}>{tournament.name}</Text>
            <View style={styles.badgeRow}>
              <Badge variant={getStatusBadgeVariant(tournament.status)}>
                {statusLabel}
              </Badge>
              <Badge variant={getFormatBadgeVariant(tournament.format)} style={{ marginLeft: Spacing.xs }}>
                {FORMAT_LABELS[tournament.format] || tournament.format}
              </Badge>
              <Badge variant="secondary" style={{ marginLeft: Spacing.xs }}>
                {tournament.sport}
              </Badge>
            </View>
          </View>
        </View>

        <View style={styles.cardMeta}>
          {tournament.start_date && (
            <Text style={styles.metaItem}>
              {tournament.start_date}{tournament.end_date ? ` - ${tournament.end_date}` : ''}
            </Text>
          )}
          {tournament.venue_name && (
            <Text style={styles.metaItem}>{tournament.venue_name}</Text>
          )}
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{participantCount}</Text>
            <Text style={styles.statLabel}>/{tournament.max_participants || '--'} players</Text>
          </View>
          {tournament.entry_fee != null && (
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: Colors.amber }]}>
                {tournament.entry_fee > 0 ? `\u20B9${tournament.entry_fee}` : 'Free'}
              </Text>
              <Text style={styles.statLabel}>entry</Text>
            </View>
          )}
          {tournament.prize_pool != null && tournament.prize_pool > 0 && (
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: Colors.primary }]}>{'\u20B9'}{tournament.prize_pool}</Text>
              <Text style={styles.statLabel}>prize</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View />
          {tournament.status === 'registration_open' && (
            <Button size="sm" onPress={() => onRegister(tournament.id)}>Register</Button>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function TournamentsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [myTournaments, setMyTournaments] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [ownerVenues, setOwnerVenues] = useState([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    sport: 'Football',
    format: 'knockout',
    max_participants: '16',
    entry_fee: '0',
    prize_pool: '0',
    venue_id: '',
    start_date: '',
    end_date: '',
    rules: '',
  });

  const isVenueOwner = user?.role === 'venue_owner';

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedSport !== 'All') params.sport = selectedSport;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (myTournaments) params.my_tournaments = true;

      const res = await tournamentAPI.list(params).catch(() => ({ data: [] }));
      setTournaments(res.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedSport, selectedStatus, myTournaments]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [selectedSport, selectedStatus, myTournaments]);

  useEffect(() => {
    if (isVenueOwner) {
      venueAPI.getOwnerVenues().then((res) => {
        setOwnerVenues(res.data || []);
      }).catch(() => {});
    }
  }, [isVenueOwner]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearch = () => {
    setLoading(true);
    loadData();
  };

  const handleRegister = async (id) => {
    try {
      await tournamentAPI.register(id);
      Alert.alert('Success', 'You have registered for the tournament!');
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to register');
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter a tournament name');
      return;
    }
    if (!form.start_date) {
      Alert.alert('Error', 'Please enter a start date');
      return;
    }
    setCreateLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        sport: form.sport,
        format: form.format,
        max_participants: parseInt(form.max_participants) || 16,
        entry_fee: parseFloat(form.entry_fee) || 0,
        prize_pool: parseFloat(form.prize_pool) || 0,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        rules: form.rules.trim(),
      };
      if (form.venue_id) payload.venue_id = form.venue_id;
      await tournamentAPI.create(payload);
      Alert.alert('Success', 'Tournament created successfully!');
      setCreateVisible(false);
      setForm({
        name: '', description: '', sport: 'Football', format: 'knockout',
        max_participants: '16', entry_fee: '0', prize_pool: '0',
        venue_id: '', start_date: '', end_date: '', rules: '',
      });
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create tournament');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>COMPETE</Text>
          <Text style={styles.headerTitle}>Tournaments</Text>
        </View>
        {isVenueOwner && (
          <Button size="sm" onPress={() => setCreateVisible(true)}>+ Create</Button>
        )}
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        onSubmit={handleSearch}
        placeholder="Search tournaments..."
        style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.sm }}
      />

      <FilterChips
        items={SPORT_FILTERS}
        selected={selectedSport}
        onSelect={setSelectedSport}
        style={{ marginBottom: Spacing.xs }}
      />

      <FilterChips
        items={STATUS_FILTERS}
        selected={selectedStatus}
        onSelect={setSelectedStatus}
        style={{ marginBottom: Spacing.sm }}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>My Tournaments</Text>
        <Switch
          value={myTournaments}
          onValueChange={setMyTournaments}
          trackColor={{ false: Colors.secondary, true: Colors.primaryLight }}
          thumbColor={myTournaments ? Colors.primary : Colors.mutedForeground}
        />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TournamentCard
              tournament={item}
              onRegister={handleRegister}
              onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={() => (
            <EmptyState
              icon="🏆"
              title="No tournaments found"
              subtitle="Try adjusting your filters or check back later"
            />
          )}
        />
      )}

      {/* Create Tournament Modal */}
      <ModalSheet visible={createVisible} onClose={() => setCreateVisible(false)} title="Create Tournament" maxHeight="92%">
        <Input
          label="Tournament Name"
          value={form.name}
          onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
          placeholder="Enter tournament name"
          autoCapitalize="words"
        />
        <Input
          label="Description"
          value={form.description}
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          placeholder="Describe the tournament"
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

        <Text style={styles.label}>Format</Text>
        <View style={styles.sportGrid}>
          {FORMAT_OPTIONS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.sportChip, form.format === f && styles.sportChipActive]}
              onPress={() => setForm((p) => ({ ...p, format: f }))}
            >
              <Text style={[styles.sportChipText, form.format === f && { color: Colors.primary }]}>
                {FORMAT_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Max Participants"
          value={form.max_participants}
          onChangeText={(v) => setForm((p) => ({ ...p, max_participants: v }))}
          placeholder="16"
          keyboardType="numeric"
        />

        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Entry Fee (\u20B9)"
              value={form.entry_fee}
              onChangeText={(v) => setForm((p) => ({ ...p, entry_fee: v }))}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Prize Pool (\u20B9)"
              value={form.prize_pool}
              onChangeText={(v) => setForm((p) => ({ ...p, prize_pool: v }))}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        </View>

        {ownerVenues.length > 0 && (
          <>
            <Text style={styles.label}>Venue</Text>
            <View style={styles.sportGrid}>
              {ownerVenues.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.sportChip, form.venue_id === v.id && styles.sportChipActive]}
                  onPress={() => setForm((p) => ({ ...p, venue_id: v.id }))}
                >
                  <Text style={[styles.sportChipText, form.venue_id === v.id && { color: Colors.primary }]}>
                    {v.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Start Date"
              value={form.start_date}
              onChangeText={(v) => setForm((p) => ({ ...p, start_date: v }))}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="End Date"
              value={form.end_date}
              onChangeText={(v) => setForm((p) => ({ ...p, end_date: v }))}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        <Input
          label="Rules"
          value={form.rules}
          onChangeText={(v) => setForm((p) => ({ ...p, rules: v }))}
          placeholder="Tournament rules and regulations"
          autoCapitalize="sentences"
          multiline
        />

        <Button onPress={handleCreate} loading={createLoading} style={{ marginTop: Spacing.sm }}>
          Create Tournament
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  toggleLabel: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  tournamentCard: { padding: Spacing.md, marginBottom: Spacing.md },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  tournamentName: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    marginBottom: Spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cardMeta: {
    gap: 4,
    marginBottom: Spacing.sm,
  },
  metaItem: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  cardStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statNumber: {
    fontSize: Typography.base,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
  },
  statLabel: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
