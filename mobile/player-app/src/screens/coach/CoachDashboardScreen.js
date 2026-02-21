import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { coachingAPI, academyAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import TabBar from '../../components/common/TabBar';
import FilterChips from '../../components/common/FilterChips';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'availability', label: 'Availability' },
  { key: 'profile', label: 'Profile' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SESSION_FILTERS = ['Upcoming', 'Completed'];

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

function SessionCard({ session, onComplete, onCancel, isUpcoming }) {
  const badgeVariant =
    session.status === 'completed' ? 'default' :
    session.status === 'scheduled' ? 'sky' :
    session.status === 'cancelled' ? 'destructive' : 'secondary';

  return (
    <Card style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sessionStudent}>{session.student_name || 'Student'}</Text>
          <Text style={styles.sessionMeta}>
            {session.date} | {session.start_time}{session.end_time ? ` - ${session.end_time}` : ''}
          </Text>
          {session.sport && <Text style={styles.sessionSport}>{session.sport}</Text>}
        </View>
        <Badge variant={badgeVariant}>{session.status || 'scheduled'}</Badge>
      </View>

      {/* Completed session review */}
      {session.status === 'completed' && session.rating && (
        <View style={styles.sessionReview}>
          <Text style={styles.sessionReviewStars}>
            {Array.from({ length: 5 }, (_, i) => i < session.rating ? '\u2605' : '\u2606').join('')}
          </Text>
          {session.review && <Text style={styles.sessionReviewText}>{session.review}</Text>}
        </View>
      )}

      {/* Action buttons for upcoming */}
      {isUpcoming && session.status !== 'cancelled' && session.status !== 'completed' && (
        <View style={styles.sessionActions}>
          <Button size="sm" onPress={() => onComplete(session.id)} style={{ flex: 1, marginRight: Spacing.sm }}>
            Complete
          </Button>
          <Button size="sm" variant="outline" onPress={() => onCancel(session.id)} style={{ flex: 1 }}>
            Cancel
          </Button>
        </View>
      )}
    </Card>
  );
}

function AvailabilityRow({ slot, onDelete }) {
  const dayName = DAYS[slot.day_of_week] || `Day ${slot.day_of_week}`;
  return (
    <View style={styles.availRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.availDay}>{dayName}</Text>
        <Text style={styles.availTime}>{slot.start_time} - {slot.end_time}</Text>
      </View>
      <TouchableOpacity onPress={() => onDelete(slot.id)}>
        <Text style={{ color: Colors.destructive, fontSize: Typography.xs, fontFamily: Typography.fontBodyBold }}>REMOVE</Text>
      </TouchableOpacity>
    </View>
  );
}

function AcademyCard({ academy, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      <Card style={styles.academyCard}>
        <Text style={styles.academyName}>{academy.name}</Text>
        <Text style={styles.academyMeta}>
          {academy.sport || 'Sport'} | {academy.student_count || 0} students
        </Text>
      </Card>
    </TouchableOpacity>
  );
}

export default function CoachDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [stats, setStats] = useState(null);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [sessionFilter, setSessionFilter] = useState('Upcoming');

  // Availability
  const [availability, setAvailability] = useState([]);
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [slotForm, setSlotForm] = useState({ day_of_week: 0, start_time: '', end_time: '' });
  const [slotSaving, setSlotSaving] = useState(false);

  // Profile
  const [profileForm, setProfileForm] = useState({
    bio: '', sports: '', hourly_rate: '', session_duration: '', city: '', venue_name: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Academies
  const [academies, setAcademies] = useState([]);
  const [academyModalVisible, setAcademyModalVisible] = useState(false);
  const [academyForm, setAcademyForm] = useState({ name: '', sport: '', description: '' });
  const [academySaving, setAcademySaving] = useState(false);

  // Academy detail
  const [selectedAcademy, setSelectedAcademy] = useState(null);
  const [academyStudents, setAcademyStudents] = useState([]);
  const [academyDetailOpen, setAcademyDetailOpen] = useState(false);
  const [addStudentEmail, setAddStudentEmail] = useState('');

  const loadStats = async () => {
    try {
      const res = await coachingAPI.stats();
      setStats(res.data);
    } catch {
      setStats(null);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await coachingAPI.listSessions();
      setSessions(res.data || []);
    } catch {
      setSessions([]);
    }
  };

  const loadAvailability = async () => {
    try {
      const res = await coachingAPI.getAvailability();
      setAvailability(res.data || []);
    } catch {
      setAvailability([]);
    }
  };

  const loadAcademies = async () => {
    try {
      const res = await academyAPI.list();
      setAcademies(res.data || []);
    } catch {
      setAcademies([]);
    }
  };

  const loadProfileData = () => {
    setProfileForm({
      bio: user?.bio || '',
      sports: user?.sports ? (Array.isArray(user.sports) ? user.sports.join(', ') : user.sports) : '',
      hourly_rate: user?.hourly_rate ? String(user.hourly_rate) : '',
      session_duration: user?.session_duration ? String(user.session_duration) : '',
      city: user?.city || '',
      venue_name: user?.venue_name || '',
    });
  };

  const loadData = async () => {
    try {
      await Promise.all([
        loadStats(),
        loadSessions(),
        loadAvailability(),
        loadAcademies(),
      ]);
      loadProfileData();
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

  // Session actions
  const handleComplete = (sessionId) => {
    Alert.alert('Complete Session', 'Mark this session as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await coachingAPI.completeSession(sessionId);
            loadSessions();
            loadStats();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to complete session');
          }
        },
      },
    ]);
  };

  const handleCancelSession = (sessionId) => {
    Alert.alert('Cancel Session', 'Are you sure you want to cancel this session?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Session', style: 'destructive',
        onPress: async () => {
          try {
            await coachingAPI.cancelSession(sessionId);
            loadSessions();
            loadStats();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to cancel session');
          }
        },
      },
    ]);
  };

  // Availability actions
  const handleAddSlot = async () => {
    if (!slotForm.start_time || !slotForm.end_time) {
      Alert.alert('Validation', 'Please fill in start time and end time.');
      return;
    }
    setSlotSaving(true);
    try {
      await coachingAPI.addAvailability({
        day_of_week: slotForm.day_of_week,
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
      });
      setSlotModalVisible(false);
      setSlotForm({ day_of_week: 0, start_time: '', end_time: '' });
      loadAvailability();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to add slot');
    } finally {
      setSlotSaving(false);
    }
  };

  const handleRemoveSlot = (slotId) => {
    Alert.alert('Remove Slot', 'Remove this availability slot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await coachingAPI.removeAvailability(slotId);
            setAvailability(prev => prev.filter(s => s.id !== slotId));
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to remove slot');
          }
        },
      },
    ]);
  };

  // Profile
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const payload = {
        bio: profileForm.bio,
        sports: profileForm.sports.split(',').map(s => s.trim()).filter(Boolean),
        hourly_rate: parseFloat(profileForm.hourly_rate) || 0,
        session_duration: parseInt(profileForm.session_duration, 10) || 60,
        city: profileForm.city,
        venue_name: profileForm.venue_name,
      };
      await coachingAPI.updateProfile(payload);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Academy actions
  const handleCreateAcademy = async () => {
    if (!academyForm.name) {
      Alert.alert('Validation', 'Academy name is required.');
      return;
    }
    setAcademySaving(true);
    try {
      await academyAPI.create({
        name: academyForm.name,
        sport: academyForm.sport,
        description: academyForm.description,
      });
      setAcademyModalVisible(false);
      setAcademyForm({ name: '', sport: '', description: '' });
      loadAcademies();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create academy');
    } finally {
      setAcademySaving(false);
    }
  };

  const openAcademyDetail = async (academy) => {
    setSelectedAcademy(academy);
    try {
      const res = await academyAPI.get(academy.id);
      setAcademyStudents(res.data?.students || []);
    } catch {
      setAcademyStudents([]);
    }
    setAcademyDetailOpen(true);
  };

  const handleAddStudent = async () => {
    if (!addStudentEmail || !selectedAcademy) return;
    try {
      await academyAPI.addStudent(selectedAcademy.id, { email: addStudentEmail });
      setAddStudentEmail('');
      const res = await academyAPI.get(selectedAcademy.id);
      setAcademyStudents(res.data?.students || []);
      loadAcademies();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to add student');
    }
  };

  const handleRemoveStudent = (studentId) => {
    if (!selectedAcademy) return;
    Alert.alert('Remove Student', 'Remove this student from the academy?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await academyAPI.removeStudent(selectedAcademy.id, studentId);
            setAcademyStudents(prev => prev.filter(s => s.id !== studentId));
            loadAcademies();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to remove student');
          }
        },
      },
    ]);
  };

  // Filtered sessions
  const today = new Date(new Date().toDateString());
  const filteredSessions = sessions.filter(s => {
    const sDate = new Date(s.date);
    if (sessionFilter === 'Upcoming') return s.status !== 'completed' && s.status !== 'cancelled' && sDate >= today;
    return s.status === 'completed' || sDate < today;
  });

  // Group availability by day
  const groupedAvailability = DAYS.map((day, idx) => ({
    day,
    dayIndex: idx,
    slots: availability.filter(a => a.day_of_week === idx),
  }));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderOverview = () => (
    <View>
      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard label="UPCOMING" value={stats?.upcoming_sessions || 0} textIcon={'\uD83D\uDCC5'} bg={Colors.skyLight} valueColor={Colors.sky} />
        <StatCard label="COMPLETED" value={stats?.completed_sessions || 0} textIcon={'\u2705'} bg={Colors.primaryLight} valueColor={Colors.primary} />
        <StatCard label="REVENUE" value={`\u20B9${(stats?.total_revenue || 0).toLocaleString('en-IN')}`} textIcon={'\uD83D\uDCB0'} bg={Colors.amberLight} valueColor={Colors.amber} />
        <StatCard label="AVG RATING" value={stats?.avg_rating ? stats.avg_rating.toFixed(1) : '0'} textIcon={'\u2B50'} bg={Colors.violetLight} valueColor={Colors.violet} />
      </View>

      {/* Recent sessions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        {sessions.slice(0, 5).length === 0 ? (
          <EmptyState icon={'\uD83D\uDCC5'} title="No sessions" subtitle="Sessions will appear here once students book with you." />
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {sessions.slice(0, 5).map((s, i) => (
              <SessionCard
                key={s.id || i}
                session={s}
                isUpcoming={new Date(s.date) >= today && s.status !== 'completed' && s.status !== 'cancelled'}
                onComplete={handleComplete}
                onCancel={handleCancelSession}
              />
            ))}
          </View>
        )}
      </View>

      {/* Academies */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Academies</Text>
          <Button size="sm" onPress={() => setAcademyModalVisible(true)}>Create</Button>
        </View>
        {academies.length === 0 ? (
          <EmptyState icon={'\uD83C\uDFEB'} title="No academies" subtitle="Create an academy to manage your students." actionLabel="Create Academy" onAction={() => setAcademyModalVisible(true)} />
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {academies.map((a, i) => (
              <AcademyCard key={a.id || i} academy={a} onPress={() => openAcademyDetail(a)} />
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderSessions = () => (
    <View>
      <FilterChips
        items={SESSION_FILTERS}
        selected={sessionFilter}
        onSelect={setSessionFilter}
        style={{ marginBottom: Spacing.md }}
      />
      {filteredSessions.length === 0 ? (
        <EmptyState icon={'\uD83D\uDCC5'} title={`No ${sessionFilter.toLowerCase()} sessions`} subtitle="Sessions will appear here." />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {filteredSessions.map((s, i) => (
            <SessionCard
              key={s.id || i}
              session={s}
              isUpcoming={sessionFilter === 'Upcoming'}
              onComplete={handleComplete}
              onCancel={handleCancelSession}
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderAvailability = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Weekly Availability</Text>
        <Button size="sm" onPress={() => setSlotModalVisible(true)}>Add Slot</Button>
      </View>
      {groupedAvailability.map((group) => (
        <View key={group.dayIndex} style={styles.dayGroup}>
          <Text style={styles.dayGroupTitle}>{group.day}</Text>
          {group.slots.length === 0 ? (
            <Text style={styles.dayGroupEmpty}>No slots</Text>
          ) : (
            <View style={{ gap: Spacing.xs }}>
              {group.slots.map((slot, i) => (
                <AvailabilityRow key={slot.id || i} slot={slot} onDelete={handleRemoveSlot} />
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderProfile = () => (
    <View>
      <Text style={styles.sectionTitle}>Coach Profile</Text>
      <View style={{ marginTop: Spacing.md }}>
        <Input
          label="Bio"
          value={profileForm.bio}
          onChangeText={(v) => setProfileForm(prev => ({ ...prev, bio: v }))}
          placeholder="Tell students about your experience..."
          multiline
          numberOfLines={4}
        />
        <Input
          label="Sports (comma-separated)"
          value={profileForm.sports}
          onChangeText={(v) => setProfileForm(prev => ({ ...prev, sports: v }))}
          placeholder="e.g. Badminton, Tennis, Football"
        />
        <Input
          label="Hourly Rate (INR)"
          value={profileForm.hourly_rate}
          onChangeText={(v) => setProfileForm(prev => ({ ...prev, hourly_rate: v }))}
          placeholder="e.g. 500"
          keyboardType="numeric"
        />
        <Input
          label="Session Duration (minutes)"
          value={profileForm.session_duration}
          onChangeText={(v) => setProfileForm(prev => ({ ...prev, session_duration: v }))}
          placeholder="e.g. 60"
          keyboardType="numeric"
        />
        <Input
          label="City"
          value={profileForm.city}
          onChangeText={(v) => setProfileForm(prev => ({ ...prev, city: v }))}
          placeholder="e.g. Mumbai"
        />
        <Input
          label="Venue / Academy Name"
          value={profileForm.venue_name}
          onChangeText={(v) => setProfileForm(prev => ({ ...prev, venue_name: v }))}
          placeholder="e.g. Sports Arena, Andheri"
        />
        <Button onPress={handleSaveProfile} loading={profileSaving} style={{ marginTop: Spacing.md }}>
          Save Profile
        </Button>
      </View>
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
          <Text style={styles.headerSub}>COACH</Text>
          <Text style={styles.headerTitle}>
            Hello, <Text style={{ color: Colors.primary }}>{user?.name?.split(' ')[0] || 'Coach'}</Text>
          </Text>
        </View>

        {/* Tabs */}
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'sessions' && renderSessions()}
          {activeTab === 'availability' && renderAvailability()}
          {activeTab === 'profile' && renderProfile()}
        </View>
      </ScrollView>

      {/* Add Availability Slot Modal */}
      <ModalSheet visible={slotModalVisible} onClose={() => setSlotModalVisible(false)} title="Add Availability Slot">
        <Text style={styles.formLabel}>Day of Week</Text>
        <View style={styles.daysGrid}>
          {DAYS.map((day, idx) => (
            <TouchableOpacity
              key={day}
              style={[styles.dayChip, slotForm.day_of_week === idx && styles.dayChipActive]}
              onPress={() => setSlotForm(prev => ({ ...prev, day_of_week: idx }))}
            >
              <Text style={[styles.dayChipText, slotForm.day_of_week === idx && styles.dayChipTextActive]}>
                {day.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input
          label="Start Time (HH:MM)"
          value={slotForm.start_time}
          onChangeText={(v) => setSlotForm(prev => ({ ...prev, start_time: v }))}
          placeholder="e.g. 09:00"
        />
        <Input
          label="End Time (HH:MM)"
          value={slotForm.end_time}
          onChangeText={(v) => setSlotForm(prev => ({ ...prev, end_time: v }))}
          placeholder="e.g. 12:00"
        />
        <Button onPress={handleAddSlot} loading={slotSaving} style={{ marginTop: Spacing.md }}>
          Add Slot
        </Button>
      </ModalSheet>

      {/* Create Academy Modal */}
      <ModalSheet visible={academyModalVisible} onClose={() => setAcademyModalVisible(false)} title="Create Academy">
        <Input
          label="Academy Name"
          value={academyForm.name}
          onChangeText={(v) => setAcademyForm(prev => ({ ...prev, name: v }))}
          placeholder="e.g. Elite Badminton Academy"
        />
        <Input
          label="Sport"
          value={academyForm.sport}
          onChangeText={(v) => setAcademyForm(prev => ({ ...prev, sport: v }))}
          placeholder="e.g. Badminton"
        />
        <Input
          label="Description"
          value={academyForm.description}
          onChangeText={(v) => setAcademyForm(prev => ({ ...prev, description: v }))}
          placeholder="About the academy..."
          multiline
        />
        <Button onPress={handleCreateAcademy} loading={academySaving} style={{ marginTop: Spacing.md }}>
          Create Academy
        </Button>
      </ModalSheet>

      {/* Academy Detail Modal */}
      <ModalSheet visible={academyDetailOpen} onClose={() => setAcademyDetailOpen(false)} title={selectedAcademy?.name || 'Academy'}>
        <Text style={styles.sectionTitle}>Students ({academyStudents.length})</Text>
        {academyStudents.length === 0 ? (
          <Text style={styles.emptyText}>No students yet. Add students by email below.</Text>
        ) : (
          <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
            {academyStudents.map((s, i) => (
              <View key={s.id || i} style={styles.studentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{s.name || s.email}</Text>
                  {s.email && <Text style={styles.studentEmail}>{s.email}</Text>}
                </View>
                <TouchableOpacity onPress={() => handleRemoveStudent(s.id)}>
                  <Text style={{ color: Colors.destructive, fontSize: Typography.xs, fontFamily: Typography.fontBodyBold }}>REMOVE</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.addStudentRow}>
          <Input
            label="Add Student by Email"
            value={addStudentEmail}
            onChangeText={setAddStudentEmail}
            placeholder="student@email.com"
            keyboardType="email-address"
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Button size="sm" onPress={handleAddStudent} style={{ marginTop: Spacing.lg, marginLeft: Spacing.sm }}>
            Add
          </Button>
        </View>
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
  header: { marginTop: Spacing.base, marginBottom: Spacing.lg },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },

  tabContent: { marginTop: Spacing.sm },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { width: '47.5%', padding: Spacing.md },
  statIconBox: { width: 36, height: 36, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  statLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },

  // Section
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.sm },

  // Session
  sessionCard: { padding: Spacing.md },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionStudent: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  sessionMeta: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
  sessionSport: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.primary, marginTop: 2 },
  sessionReview: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  sessionReviewStars: { fontSize: Typography.base, color: Colors.amber, marginBottom: 4 },
  sessionReviewText: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  sessionActions: { flexDirection: 'row', marginTop: Spacing.md },

  // Availability
  dayGroup: { marginBottom: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dayGroupTitle: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginBottom: Spacing.sm },
  dayGroupEmpty: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, fontStyle: 'italic' },
  availRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: Spacing.md, borderRadius: Spacing.radiusMd, borderWidth: 1, borderColor: Colors.border },
  availDay: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  availTime: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.sky, marginTop: 2 },

  // Academy
  academyCard: { padding: Spacing.md },
  academyName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  academyMeta: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },

  // Student
  studentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  studentName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  studentEmail: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  addStudentRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: Spacing.md },

  emptyText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: Spacing.sm },

  // Form
  formLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  dayChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border },
  dayChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  dayChipText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  dayChipTextActive: { color: Colors.primary },
});
