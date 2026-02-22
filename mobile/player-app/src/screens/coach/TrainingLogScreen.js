import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { trainingAPI, organizationAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

function StatCard({ label, value, textIcon, bg, valueColor }) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 14 }}>{textIcon}</Text>
      </View>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function TrainingCard({ log, expanded, onToggle }) {
  const presentCount = (log.attendance || []).filter(a => a.present).length;
  const totalCount = (log.attendance || []).length;
  const drills = log.drills || [];

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onToggle}>
      <Card style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.logTitle}>{log.title || 'Training Session'}</Text>
            <Text style={styles.logMeta}>
              {log.date} {log.duration_minutes ? `| ${log.duration_minutes} min` : ''}
            </Text>
          </View>
          {log.sport && <Badge variant="amber">{log.sport}</Badge>}
        </View>

        <View style={styles.logStatsRow}>
          <View style={styles.logStatItem}>
            <Text style={styles.logStatIcon}>{'\u23F1\uFE0F'}</Text>
            <Text style={styles.logStatText}>{log.duration_minutes || 0} min</Text>
          </View>
          <View style={styles.logStatItem}>
            <Text style={styles.logStatIcon}>{'\uD83D\uDC65'}</Text>
            <Text style={styles.logStatText}>{presentCount}/{totalCount}</Text>
          </View>
        </View>

        {drills.length > 0 && (
          <View style={styles.drillsRow}>
            {drills.map((drill, i) => (
              <Badge key={i} variant="secondary" style={{ marginRight: Spacing.xs, marginBottom: Spacing.xs }}>
                {drill}
              </Badge>
            ))}
          </View>
        )}

        {expanded && (
          <View style={styles.expandedSection}>
            <View style={styles.divider} />
            <Text style={styles.expandedTitle}>{'\uD83D\uDC65'} Attendance Details</Text>
            {(log.attendance || []).length === 0 ? (
              <Text style={styles.emptyText}>No attendance recorded.</Text>
            ) : (
              (log.attendance || []).map((a, i) => (
                <View key={i} style={styles.attendeeRow}>
                  <View style={[styles.attendeeDot, { backgroundColor: a.present ? Colors.emerald : Colors.destructive }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attendeeName}>{a.player_name || `Player ${a.player_id}`}</Text>
                    {a.performance_note ? (
                      <Text style={styles.attendeeNote}>{'\uD83D\uDCDD'} {a.performance_note}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.attendeeStatus, { color: a.present ? Colors.emerald : Colors.destructive }]}>
                    {a.present ? 'Present' : 'Absent'}
                  </Text>
                </View>
              ))
            )}
            {log.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>{'\uD83D\uDCDD'} Notes</Text>
                <Text style={styles.notesText}>{log.notes}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

export default function TrainingLogScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', sport: '', date: '', duration_minutes: '', drills: '', notes: '',
  });
  const [players, setPlayers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [perfNotes, setPerfNotes] = useState({});

  const loadStats = async () => {
    try {
      const res = await trainingAPI.stats();
      setStats(res.data);
    } catch {
      setStats(null);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await trainingAPI.list();
      setLogs(res.data || []);
    } catch {
      setLogs([]);
    }
  };

  const loadData = async () => {
    try {
      await Promise.all([loadStats(), loadLogs()]);
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

  const openModal = async () => {
    setForm({ title: '', sport: '', date: '', duration_minutes: '', drills: '', notes: '' });
    setAttendance({});
    setPerfNotes({});
    setPlayers([]);
    setModalVisible(true);

    try {
      const res = await organizationAPI.my();
      const orgs = res.data || [];
      const allPlayers = [];
      orgs.forEach(org => {
        (org.players || []).forEach(p => {
          if (!allPlayers.find(ap => ap.id === p.id)) {
            allPlayers.push(p);
          }
        });
      });
      setPlayers(allPlayers);
      const initial = {};
      allPlayers.forEach(p => { initial[p.id] = true; });
      setAttendance(initial);
    } catch {
      setPlayers([]);
    }
  };

  const toggleAttendance = (playerId) => {
    setAttendance(prev => ({ ...prev, [playerId]: !prev[playerId] }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation', 'Please enter a session title.');
      return;
    }
    if (!form.date.trim()) {
      Alert.alert('Validation', 'Please enter the session date (YYYY-MM-DD).');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        sport: form.sport.trim() || undefined,
        date: form.date.trim(),
        duration_minutes: parseInt(form.duration_minutes, 10) || 60,
        drills: form.drills.split(',').map(d => d.trim()).filter(Boolean),
        notes: form.notes.trim() || undefined,
        attendance: players.map(p => ({
          player_id: p.id,
          player_name: p.name || p.email,
          present: !!attendance[p.id],
          performance_note: (perfNotes[p.id] || '').trim() || undefined,
        })),
      };
      await trainingAPI.log(payload);
      setModalVisible(false);
      Alert.alert('Success', 'Training session logged successfully.');
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to log training session.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const totalSessions = stats?.total_sessions || 0;
  const totalHours = stats?.total_hours != null ? Number(stats.total_hours).toFixed(1) : '0';
  const avgAttendance = stats?.avg_attendance != null
    ? `${Math.round(stats.avg_attendance)}%`
    : '0%';

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
            <Text style={styles.headerTitle}>{'\uD83D\uDCCB'} Training Logs</Text>
          </View>
          <Button size="sm" onPress={openModal}>+ Log</Button>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="TOTAL SESSIONS" value={totalSessions} textIcon={'\uD83C\uDFCB\uFE0F'} bg={Colors.primaryLight} valueColor={Colors.primary} />
          <StatCard label="TOTAL HOURS" value={totalHours} textIcon={'\u23F1\uFE0F'} bg={Colors.amberLight} valueColor={Colors.amber} />
          <StatCard label="AVG ATTENDANCE" value={avgAttendance} textIcon={'\uD83D\uDC65'} bg={Colors.emeraldLight} valueColor={Colors.emerald} />
        </View>

        {/* Training Logs List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{'\uD83C\uDFCB\uFE0F'} Recent Training Logs</Text>
          {logs.length === 0 ? (
            <EmptyState
              icon={'\uD83D\uDCCB'}
              title="No training logs"
              subtitle="Log your first training session to start tracking progress."
              actionLabel="Log Session"
              onAction={openModal}
            />
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {logs.map((log, i) => (
                <TrainingCard
                  key={log.id || i}
                  log={log}
                  expanded={expandedId === (log.id || i)}
                  onToggle={() => setExpandedId(prev => prev === (log.id || i) ? null : (log.id || i))}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Log Training Modal */}
      <ModalSheet visible={modalVisible} onClose={() => setModalVisible(false)} title="Log Training Session">
        <Input
          label="Title"
          value={form.title}
          onChangeText={(v) => setForm(prev => ({ ...prev, title: v }))}
          placeholder="e.g. Morning Fitness Drill"
        />
        <Input
          label="Sport"
          value={form.sport}
          onChangeText={(v) => setForm(prev => ({ ...prev, sport: v }))}
          placeholder="e.g. Badminton"
        />
        <Input
          label="Date (YYYY-MM-DD)"
          value={form.date}
          onChangeText={(v) => setForm(prev => ({ ...prev, date: v }))}
          placeholder="e.g. 2026-02-22"
        />
        <Input
          label="Duration (minutes)"
          value={form.duration_minutes}
          onChangeText={(v) => setForm(prev => ({ ...prev, duration_minutes: v }))}
          placeholder="e.g. 90"
          keyboardType="numeric"
        />
        <Input
          label="Drills (comma-separated)"
          value={form.drills}
          onChangeText={(v) => setForm(prev => ({ ...prev, drills: v }))}
          placeholder="e.g. Warm-up, Sprints, Cool-down"
        />
        <Input
          label="Notes"
          value={form.notes}
          onChangeText={(v) => setForm(prev => ({ ...prev, notes: v }))}
          placeholder="Session notes..."
          multiline
          numberOfLines={3}
        />

        {/* Player Attendance */}
        <Text style={styles.formLabel}>{'\uD83D\uDC65'} PLAYER ATTENDANCE</Text>
        {players.length === 0 ? (
          <Text style={styles.emptyText}>No players found in your organization.</Text>
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {players.map((p) => (
              <View key={p.id} style={styles.attendancePlayerRow}>
                <TouchableOpacity
                  style={[styles.checkbox, attendance[p.id] && styles.checkboxActive]}
                  onPress={() => toggleAttendance(p.id)}
                >
                  {attendance[p.id] && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text style={styles.playerName}>{p.name || p.email}</Text>
                  <Input
                    placeholder="Performance note (optional)"
                    value={perfNotes[p.id] || ''}
                    onChangeText={(v) => setPerfNotes(prev => ({ ...prev, [p.id]: v }))}
                    style={{ marginBottom: 0, marginTop: Spacing.xs }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <Button onPress={handleSubmit} loading={saving} style={{ marginTop: Spacing.lg }}>
          Log Session
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

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { width: '31%', padding: Spacing.md },
  statIconBox: { width: 36, height: 36, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  statLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },

  // Section
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.md },

  // Log card
  logCard: { padding: Spacing.md },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logTitle: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  logMeta: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
  logStatsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  logStatItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  logStatIcon: { fontSize: 12 },
  logStatText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  drillsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.sm },

  // Expanded section
  expandedSection: { marginTop: Spacing.sm },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.sm },
  expandedTitle: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginBottom: Spacing.sm },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  attendeeDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  attendeeName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  attendeeNote: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  attendeeStatus: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold },
  notesBox: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd },
  notesLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginBottom: Spacing.xs },
  notesText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },

  // Form
  formLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  emptyText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: Spacing.sm },

  // Attendance checkboxes
  attendancePlayerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checkbox: { width: 24, height: 24, borderRadius: Spacing.radiusSm, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: Colors.white, fontSize: 14, fontFamily: Typography.fontBodyBold },
  playerName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
});
