import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SearchBar from '../../components/common/SearchBar';
import TabBar from '../../components/common/TabBar';
import FilterChips from '../../components/common/FilterChips';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'venues', label: 'Venues' },
  { key: 'settings', label: 'Settings' },
];

const ROLE_FILTERS = ['All', 'Player', 'Venue Owner', 'Coach'];

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

function getRoleBadgeVariant(role) {
  if (role === 'admin') return 'violet';
  if (role === 'venue_owner') return 'amber';
  if (role === 'coach') return 'sky';
  return 'default';
}

function getStatusBadgeVariant(status) {
  if (status === 'active') return 'default';
  if (status === 'pending') return 'amber';
  if (status === 'suspended') return 'destructive';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
}

function UserCard({ user, onApprove, onReject, onSuspend, onActivate }) {
  const status = user.account_status || 'active';
  const role = user.role || 'player';

  return (
    <Card style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <Text style={styles.userName} numberOfLines={1}>{user.name || 'Unknown'}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
          <Badge variant={getRoleBadgeVariant(role)}>{role.replace('_', ' ')}</Badge>
          <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
        </View>
      </View>

      {/* Action buttons based on status */}
      <View style={styles.userActions}>
        {status === 'pending' && (
          <>
            <Button size="sm" onPress={() => onApprove(user.id)} style={styles.actionBtn}>
              Approve
            </Button>
            <Button size="sm" variant="destructive" onPress={() => onReject(user.id)} style={styles.actionBtn}>
              Reject
            </Button>
          </>
        )}
        {status === 'active' && (
          <Button size="sm" variant="outline" onPress={() => onSuspend(user.id)} style={styles.actionBtn}>
            Suspend
          </Button>
        )}
        {(status === 'suspended' || status === 'rejected') && (
          <Button size="sm" onPress={() => onActivate(user.id)} style={styles.actionBtn}>
            Activate
          </Button>
        )}
      </View>
    </Card>
  );
}

function VenueCard({ venue, onSuspend, onActivate }) {
  const isActive = venue.status !== 'suspended';

  return (
    <Card style={styles.venueCard}>
      <View style={styles.venueRow}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
          <Text style={styles.venueOwner}>Owner: {venue.owner_name || 'N/A'}</Text>
          <Badge variant={isActive ? 'default' : 'destructive'} style={{ marginTop: Spacing.xs }}>
            {venue.status || 'active'}
          </Badge>
        </View>
        {isActive ? (
          <Button size="sm" variant="outline" onPress={() => onSuspend(venue.id)}>
            Suspend
          </Button>
        ) : (
          <Button size="sm" onPress={() => onActivate(venue.id)}>
            Activate
          </Button>
        )}
      </View>
    </Card>
  );
}

function RegistrationRow({ reg }) {
  return (
    <View style={styles.regRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.regName}>{reg.name || 'User'}</Text>
        <Text style={styles.regEmail}>{reg.email}</Text>
      </View>
      <Badge variant={getRoleBadgeVariant(reg.role)}>{(reg.role || 'player').replace('_', ' ')}</Badge>
    </View>
  );
}

export default function AdminScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dashboard
  const [dashboardData, setDashboardData] = useState(null);

  // Users
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // Venues
  const [venues, setVenues] = useState([]);

  // Settings
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    commission_percentage: '',
    payment_key_id: '',
    payment_key_secret: '',
    s3_bucket: '',
    s3_region: '',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Change password
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await adminAPI.dashboard();
      setDashboardData(res.data);
    } catch {
      setDashboardData(null);
    }
  };

  const loadUsers = async () => {
    try {
      const params = {};
      if (roleFilter !== 'All') {
        const roleMap = { 'Player': 'player', 'Venue Owner': 'venue_owner', 'Coach': 'coach' };
        params.role = roleMap[roleFilter] || undefined;
      }
      if (userSearch) params.search = userSearch;
      const res = await adminAPI.users(params);
      setUsers(res.data || []);
    } catch {
      setUsers([]);
    }
  };

  const loadVenues = async () => {
    try {
      const res = await adminAPI.venues();
      setVenues(res.data || []);
    } catch {
      setVenues([]);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await adminAPI.getSettings();
      const s = res.data || {};
      setSettings(s);
      setSettingsForm({
        commission_percentage: s.commission_percentage != null ? String(s.commission_percentage) : '',
        payment_key_id: s.payment_key_id || '',
        payment_key_secret: s.payment_key_secret || '',
        s3_bucket: s.s3_bucket || '',
        s3_region: s.s3_region || '',
      });
    } catch {
      setSettings(null);
    }
  };

  const loadData = async () => {
    try {
      await Promise.all([
        loadDashboard(),
        loadUsers(),
        loadVenues(),
        loadSettings(),
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!loading) {
      loadUsers();
    }
  }, [roleFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearchSubmit = () => {
    loadUsers();
  };

  // User actions
  const handleApproveUser = (userId) => {
    Alert.alert('Approve User', 'Approve this user account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            await adminAPI.approveUser(userId);
            loadUsers();
            loadDashboard();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to approve user');
          }
        },
      },
    ]);
  };

  const handleRejectUser = (userId) => {
    Alert.alert('Reject User', 'Reject this user account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.rejectUser(userId);
            loadUsers();
            loadDashboard();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to reject user');
          }
        },
      },
    ]);
  };

  const handleSuspendUser = (userId) => {
    Alert.alert('Suspend User', 'Suspend this user account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend', style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.suspendUser(userId);
            loadUsers();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to suspend user');
          }
        },
      },
    ]);
  };

  const handleActivateUser = (userId) => {
    Alert.alert('Activate User', 'Activate this user account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Activate',
        onPress: async () => {
          try {
            await adminAPI.activateUser(userId);
            loadUsers();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to activate user');
          }
        },
      },
    ]);
  };

  // Venue actions
  const handleSuspendVenue = (venueId) => {
    Alert.alert('Suspend Venue', 'Suspend this venue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend', style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.suspendVenue(venueId);
            loadVenues();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to suspend venue');
          }
        },
      },
    ]);
  };

  const handleActivateVenue = (venueId) => {
    Alert.alert('Activate Venue', 'Activate this venue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Activate',
        onPress: async () => {
          try {
            await adminAPI.activateVenue(venueId);
            loadVenues();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to activate venue');
          }
        },
      },
    ]);
  };

  // Settings
  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await adminAPI.updateSettings({
        commission_percentage: parseFloat(settingsForm.commission_percentage) || 0,
        payment_key_id: settingsForm.payment_key_id,
        payment_key_secret: settingsForm.payment_key_secret,
        s3_bucket: settingsForm.s3_bucket,
        s3_region: settingsForm.s3_region,
      });
      Alert.alert('Success', 'Settings updated successfully.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to update settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      Alert.alert('Validation', 'Please fill in both password fields.');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      Alert.alert('Validation', 'New password must be at least 6 characters.');
      return;
    }
    setPasswordSaving(true);
    try {
      await adminAPI.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      Alert.alert('Success', 'Password changed successfully.');
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    if (userSearch) {
      const q = userSearch.toLowerCase();
      if (!(u.name || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderDashboard = () => (
    <View>
      <View style={styles.statsGrid}>
        <StatCard
          label="TOTAL USERS"
          value={dashboardData?.total_users || 0}
          textIcon={'\uD83D\uDC65'}
          bg={Colors.primaryLight}
          valueColor={Colors.primary}
        />
        <StatCard
          label="TOTAL VENUES"
          value={dashboardData?.total_venues || 0}
          textIcon={'\uD83C\uDFDF\uFE0F'}
          bg={Colors.violetLight}
          valueColor={Colors.violet}
        />
        <StatCard
          label="TOTAL BOOKINGS"
          value={dashboardData?.total_bookings || 0}
          textIcon={'\uD83D\uDCCB'}
          bg={Colors.skyLight}
          valueColor={Colors.sky}
        />
        <StatCard
          label="REVENUE"
          value={`\u20B9${(dashboardData?.total_revenue || 0).toLocaleString('en-IN')}`}
          textIcon={'\uD83D\uDCB0'}
          bg={Colors.amberLight}
          valueColor={Colors.amber}
        />
      </View>

      {/* Commission */}
      {dashboardData?.total_commission != null && (
        <Card style={styles.commissionCard}>
          <View style={styles.commissionRow}>
            <View>
              <Text style={styles.commissionLabel}>PLATFORM COMMISSION</Text>
              <Text style={styles.commissionValue}>
                {'\u20B9'}{(dashboardData.total_commission || 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.statIconBox, { backgroundColor: Colors.primaryLight }]}>
              <Text style={{ fontSize: 20 }}>{'\uD83D\uDCB8'}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Recent registrations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Registrations</Text>
        {dashboardData?.recent_registrations && dashboardData.recent_registrations.length > 0 ? (
          <Card style={{ padding: 0 }}>
            {dashboardData.recent_registrations.map((reg, i) => (
              <View key={reg.id || i}>
                <RegistrationRow reg={reg} />
                {i < dashboardData.recent_registrations.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon={'\uD83D\uDC65'} title="No recent registrations" subtitle="New user registrations will appear here." />
        )}
      </View>
    </View>
  );

  const renderUsers = () => (
    <View>
      <SearchBar
        value={userSearch}
        onChangeText={setUserSearch}
        onSubmit={handleSearchSubmit}
        placeholder="Search users by name or email..."
        style={{ marginBottom: Spacing.md }}
      />

      <FilterChips
        items={ROLE_FILTERS}
        selected={roleFilter}
        onSelect={setRoleFilter}
        style={{ marginBottom: Spacing.md }}
      />

      {filteredUsers.length === 0 ? (
        <EmptyState icon={'\uD83D\uDC65'} title="No users found" subtitle="Try a different search or filter." />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {filteredUsers.map((u, i) => (
            <UserCard
              key={u.id || i}
              user={u}
              onApprove={handleApproveUser}
              onReject={handleRejectUser}
              onSuspend={handleSuspendUser}
              onActivate={handleActivateUser}
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderVenues = () => (
    <View>
      <Text style={styles.sectionTitle}>All Venues ({venues.length})</Text>
      {venues.length === 0 ? (
        <EmptyState icon={'\uD83C\uDFDF\uFE0F'} title="No venues" subtitle="Venues will appear here once owners register." />
      ) : (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {venues.map((v, i) => (
            <VenueCard
              key={v.id || i}
              venue={v}
              onSuspend={handleSuspendVenue}
              onActivate={handleActivateVenue}
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderSettings = () => (
    <View>
      <Text style={styles.sectionTitle}>Platform Settings</Text>
      <View style={{ marginTop: Spacing.md }}>
        <Input
          label="Commission Percentage (%)"
          value={settingsForm.commission_percentage}
          onChangeText={(v) => setSettingsForm(prev => ({ ...prev, commission_percentage: v }))}
          placeholder="e.g. 10"
          keyboardType="numeric"
        />

        <Text style={styles.subsectionTitle}>Payment Gateway</Text>
        <Input
          label="Key ID"
          value={settingsForm.payment_key_id}
          onChangeText={(v) => setSettingsForm(prev => ({ ...prev, payment_key_id: v }))}
          placeholder="Razorpay Key ID"
        />
        <Input
          label="Key Secret"
          value={settingsForm.payment_key_secret}
          onChangeText={(v) => setSettingsForm(prev => ({ ...prev, payment_key_secret: v }))}
          placeholder="Razorpay Key Secret"
          secureTextEntry
        />

        <Text style={styles.subsectionTitle}>S3 Storage</Text>
        <Input
          label="S3 Bucket Name"
          value={settingsForm.s3_bucket}
          onChangeText={(v) => setSettingsForm(prev => ({ ...prev, s3_bucket: v }))}
          placeholder="e.g. horizon-uploads"
        />
        <Input
          label="S3 Region"
          value={settingsForm.s3_region}
          onChangeText={(v) => setSettingsForm(prev => ({ ...prev, s3_region: v }))}
          placeholder="e.g. ap-south-1"
        />

        <Button onPress={handleSaveSettings} loading={settingsSaving} style={{ marginTop: Spacing.md }}>
          Save Settings
        </Button>
      </View>

      {/* Change Password */}
      <View style={styles.passwordSection}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <View style={{ marginTop: Spacing.md }}>
          <Input
            label="Current Password"
            value={passwordForm.current_password}
            onChangeText={(v) => setPasswordForm(prev => ({ ...prev, current_password: v }))}
            placeholder="Enter current password"
            secureTextEntry
          />
          <Input
            label="New Password"
            value={passwordForm.new_password}
            onChangeText={(v) => setPasswordForm(prev => ({ ...prev, new_password: v }))}
            placeholder="Enter new password (min 6 chars)"
            secureTextEntry
          />
          <Button variant="secondary" onPress={handleChangePassword} loading={passwordSaving} style={{ marginTop: Spacing.md }}>
            Change Password
          </Button>
        </View>
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
          <Text style={styles.headerSub}>SUPER ADMIN</Text>
          <Text style={styles.headerTitle}>Admin Console</Text>
        </View>

        {/* Tabs */}
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'venues' && renderVenues()}
          {activeTab === 'settings' && renderSettings()}
        </View>
      </ScrollView>
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

  // Commission
  commissionCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commissionLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5 },
  commissionValue: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.primary, marginTop: 4 },

  // Section
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.sm },
  subsectionTitle: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginTop: Spacing.lg, marginBottom: Spacing.sm },

  // Registration row
  regRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  regName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  regEmail: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border },

  // User card
  userCard: { padding: Spacing.md },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  userEmail: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  userActions: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.sm },
  actionBtn: { minWidth: 80 },

  // Venue card
  venueCard: { padding: Spacing.md },
  venueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  venueName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  venueOwner: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },

  // Password section
  passwordSection: { marginTop: Spacing.xl2, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border },
});
