import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { performanceAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import FilterChips from '../../components/common/FilterChips';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const FILTERS = ['My Submitted', 'All Records'];
const RECORD_TYPES = ['match_result', 'training', 'assessment', 'tournament_result', 'achievement'];

const TYPE_CONFIG = {
  training:          { badge: 'violet',  icon: '\uD83C\uDFCB\uFE0F', label: 'Training' },
  match_result:      { badge: 'emerald', icon: '\u26A1',             label: 'Match' },
  assessment:        { badge: 'sky',     icon: '\uD83D\uDCDD',       label: 'Assessment' },
  tournament_result: { badge: 'amber',   icon: '\uD83C\uDFC6',       label: 'Tournament' },
  achievement:       { badge: 'rose',    icon: '\uD83C\uDF1F',       label: 'Achievement' },
};

function RecordCard({ record, onDelete }) {
  const cfg = TYPE_CONFIG[record.record_type] || TYPE_CONFIG.training;
  const statsEntries = record.stats ? Object.entries(record.stats) : [];

  return (
    <Card style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recordPlayer}>{record.player_name || 'Player'}</Text>
          <Text style={styles.recordTitle}>{record.title || 'Untitled'}</Text>
          <Text style={styles.recordDate}>{record.date || record.created_at?.slice(0, 10) || '-'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
          <Badge variant={cfg.badge}>{cfg.icon} {cfg.label}</Badge>
          {record.sport && <Badge variant="secondary">{record.sport}</Badge>}
        </View>
      </View>

      {statsEntries.length > 0 && (
        <View style={styles.statsRow}>
          {statsEntries.map(([key, val]) => (
            <View key={key} style={styles.statChip}>
              <Text style={styles.statKey}>{key.replace(/_/g, ' ')}</Text>
              <Text style={styles.statVal}>{String(val)}</Text>
            </View>
          ))}
        </View>
      )}

      {record.notes ? (
        <Text style={styles.recordNotes} numberOfLines={2}>{record.notes}</Text>
      ) : null}

      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(record.id)}>
        <Text style={styles.deleteBtnText}>DELETE</Text>
      </TouchableOpacity>
    </Card>
  );
}

export default function PerformanceRecordsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [filter, setFilter] = useState('My Submitted');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState([]);

  // Create record modal
  const [createVisible, setCreateVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    player_id: '', record_type: 'match_result', sport: '', title: '', date: '', notes: '',
  });
  const [statsForm, setStatsForm] = useState({ result: '', score: '', duration_minutes: '', placement: '' });

  // Bulk modal
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkPlayerIds, setBulkPlayerIds] = useState('');

  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const updateStats = (key, val) => setStatsForm(prev => ({ ...prev, [key]: val }));

  const loadRecords = async () => {
    try {
      const res = await performanceAPI.myRecords();
      setRecords(res.data || []);
    } catch {
      setRecords([]);
    }
  };

  const loadData = async () => {
    try {
      await loadRecords();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const buildStats = () => {
    const s = {};
    if (form.record_type === 'match_result') {
      if (statsForm.result) s.result = statsForm.result;
      if (statsForm.score) s.score = statsForm.score;
    } else if (form.record_type === 'training') {
      if (statsForm.duration_minutes) s.duration_minutes = parseInt(statsForm.duration_minutes, 10) || 0;
    } else if (form.record_type === 'tournament_result') {
      if (statsForm.result) s.result = statsForm.result;
      if (statsForm.placement) s.placement = statsForm.placement;
    }
    return s;
  };

  const resetForms = () => {
    setForm({ player_id: '', record_type: 'match_result', sport: '', title: '', date: '', notes: '' });
    setStatsForm({ result: '', score: '', duration_minutes: '', placement: '' });
  };

  const handleCreate = async () => {
    if (!form.player_id || !form.title) {
      Alert.alert('Validation', 'Player ID and title are required.');
      return;
    }
    setSaving(true);
    try {
      await performanceAPI.createRecord({
        player_id: form.player_id,
        record_type: form.record_type,
        sport: form.sport || undefined,
        title: form.title,
        date: form.date || undefined,
        notes: form.notes || undefined,
        stats: buildStats(),
      });
      setCreateVisible(false);
      resetForms();
      loadRecords();
      Alert.alert('Success', 'Record created.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create record');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkCreate = async () => {
    const ids = bulkPlayerIds.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0 || !form.title) {
      Alert.alert('Validation', 'Player IDs and title are required.');
      return;
    }
    setBulkSaving(true);
    try {
      await performanceAPI.createBulk({
        player_ids: ids,
        record_type: form.record_type,
        sport: form.sport || undefined,
        title: form.title,
        date: form.date || undefined,
        notes: form.notes || undefined,
        stats: buildStats(),
      });
      setBulkVisible(false);
      setBulkPlayerIds('');
      resetForms();
      loadRecords();
      Alert.alert('Success', `Bulk records created for ${ids.length} players.`);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create bulk records');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleDelete = (recordId) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await performanceAPI.deleteRecord(recordId);
            setRecords(prev => prev.filter(r => r.id !== recordId));
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete record');
          }
        },
      },
    ]);
  };

  const filteredRecords = filter === 'My Submitted'
    ? records.filter(r => r.created_by === user?.id || r.coach_id === user?.id)
    : records;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderTypeSelector = () => (
    <View>
      <Text style={styles.formLabel}>Record Type</Text>
      <View style={styles.typeGrid}>
        {RECORD_TYPES.map((type) => {
          const cfg = TYPE_CONFIG[type];
          const active = form.record_type === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, active && styles.typeChipActive]}
              onPress={() => updateForm('record_type', type)}
            >
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {cfg.icon} {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderDynamicStats = () => {
    if (form.record_type === 'match_result') {
      return (
        <View>
          <Input label="Result (win / loss / draw)" value={statsForm.result} onChangeText={(v) => updateStats('result', v)} placeholder="e.g. win" />
          <Input label="Score" value={statsForm.score} onChangeText={(v) => updateStats('score', v)} placeholder="e.g. 3-1" />
        </View>
      );
    }
    if (form.record_type === 'training') {
      return (
        <Input label="Duration (minutes)" value={statsForm.duration_minutes} onChangeText={(v) => updateStats('duration_minutes', v)} placeholder="e.g. 90" keyboardType="numeric" />
      );
    }
    if (form.record_type === 'tournament_result') {
      return (
        <View>
          <Input label="Result (win / loss / draw)" value={statsForm.result} onChangeText={(v) => updateStats('result', v)} placeholder="e.g. win" />
          <Input label="Placement" value={statsForm.placement} onChangeText={(v) => updateStats('placement', v)} placeholder="e.g. 1st" />
        </View>
      );
    }
    return null;
  };

  const renderFormFields = () => (
    <View>
      {renderTypeSelector()}
      <Input label="Sport" value={form.sport} onChangeText={(v) => updateForm('sport', v)} placeholder="e.g. Badminton" />
      <Input label="Title" value={form.title} onChangeText={(v) => updateForm('title', v)} placeholder="e.g. District finals match" />
      <Input label="Date (YYYY-MM-DD)" value={form.date} onChangeText={(v) => updateForm('date', v)} placeholder="e.g. 2026-02-22" />
      <Input label="Notes" value={form.notes} onChangeText={(v) => updateForm('notes', v)} placeholder="Additional notes..." multiline numberOfLines={3} />
      {renderDynamicStats()}
    </View>
  );

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
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>COACH</Text>
            <Text style={styles.headerTitle}>{'\uD83D\uDCCA'} Performance Records</Text>
          </View>
          <Button size="sm" onPress={() => setCreateVisible(true)}>+ New</Button>
        </View>

        {/* Filter row */}
        <FilterChips
          items={FILTERS}
          selected={filter}
          onSelect={setFilter}
          style={{ marginBottom: Spacing.md }}
        />

        {/* Bulk action */}
        <Button variant="outline" size="sm" onPress={() => setBulkVisible(true)} style={{ alignSelf: 'flex-start', marginBottom: Spacing.lg }}>
          Bulk Record
        </Button>

        {/* Records list */}
        {filteredRecords.length === 0 ? (
          <EmptyState
            icon={'\uD83D\uDCCA'}
            title="No records yet"
            subtitle="Create a performance record for your players."
            actionLabel="Create Record"
            onAction={() => setCreateVisible(true)}
          />
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {filteredRecords.map((r, i) => (
              <RecordCard key={r.id || i} record={r} onDelete={handleDelete} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Record Modal */}
      <ModalSheet visible={createVisible} onClose={() => setCreateVisible(false)} title="Create Record">
        <Input label="Player ID" value={form.player_id} onChangeText={(v) => updateForm('player_id', v)} placeholder="Enter player ID" />
        {renderFormFields()}
        <Button onPress={handleCreate} loading={saving} style={{ marginTop: Spacing.md }}>
          Create Record
        </Button>
      </ModalSheet>

      {/* Bulk Record Modal */}
      <ModalSheet visible={bulkVisible} onClose={() => setBulkVisible(false)} title="Bulk Record">
        <Input label="Player IDs (comma separated)" value={bulkPlayerIds} onChangeText={setBulkPlayerIds} placeholder="e.g. id1, id2, id3" multiline numberOfLines={2} />
        {renderFormFields()}
        <Button onPress={handleBulkCreate} loading={bulkSaving} style={{ marginTop: Spacing.md }}>
          Create Bulk Records
        </Button>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl * 3 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.base, marginBottom: Spacing.lg },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },

  // Record card
  recordCard: { padding: Spacing.md },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recordPlayer: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  recordTitle: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  recordDate: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
  recordNotes: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: Spacing.sm, fontStyle: 'italic' },

  // Stats row
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  statChip: { backgroundColor: Colors.secondary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Spacing.radiusMd, borderWidth: 1, borderColor: Colors.border },
  statKey: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1 },
  statVal: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginTop: 1 },

  // Delete
  deleteBtn: { alignSelf: 'flex-end', marginTop: Spacing.sm },
  deleteBtnText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.destructive, letterSpacing: 0.5 },

  // Form
  formLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  typeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  typeChipText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  typeChipTextActive: { color: Colors.primary },
});
