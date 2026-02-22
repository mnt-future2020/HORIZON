import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { organizationAPI, userSearchAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const ORG_TYPES = ['individual_coach', 'academy', 'school', 'college'];

const ORG_TYPE_LABELS = {
  individual_coach: 'Coach',
  academy: 'Academy',
  school: 'School',
  college: 'College',
};

const ORG_TYPE_VARIANTS = {
  individual_coach: 'amber',
  academy: 'default',
  school: 'violet',
  college: 'sky',
};

function OrgStatBox({ label, value, textIcon, bg, valueColor }) {
  return (
    <View style={styles.orgStatBox}>
      <View style={[styles.orgStatIconBox, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 14 }}>{textIcon}</Text>
      </View>
      <Text style={[styles.orgStatValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.orgStatLabel}>{label}</Text>
    </View>
  );
}

function MemberRow({ member, onRemove, roleLabel }) {
  return (
    <View style={styles.memberRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>{member.name || member.email || 'Unknown'}</Text>
        {member.email && <Text style={styles.memberEmail}>{member.email}</Text>}
      </View>
      <TouchableOpacity onPress={() => onRemove(member.id || member.user_id)}>
        <Text style={{ color: Colors.destructive, fontSize: Typography.xs, fontFamily: Typography.fontBodyBold }}>REMOVE</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OrganizationScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [expandedOrgId, setExpandedOrgId] = useState(null);

  // Create org modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', org_type: 'individual_coach', sports: '', description: '',
    location: '', city: '', contact_email: '', contact_phone: '',
  });
  const [createSaving, setCreateSaving] = useState(false);

  // Expanded org detail
  const [orgDetail, setOrgDetail] = useState(null);
  const [orgPlayers, setOrgPlayers] = useState([]);
  const [orgStaff, setOrgStaff] = useState([]);
  const [orgDashboard, setOrgDashboard] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Add member modals
  const [addPlayerModalVisible, setAddPlayerModalVisible] = useState(false);
  const [addStaffModalVisible, setAddStaffModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const loadOrganizations = async () => {
    try {
      const res = await organizationAPI.my();
      setOrganizations(res.data || []);
    } catch {
      setOrganizations([]);
    }
  };

  const loadData = async () => {
    try {
      await loadOrganizations();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setExpandedOrgId(null);
    setOrgDetail(null);
    loadData();
  };

  const loadOrgDetail = async (orgId) => {
    setDetailLoading(true);
    try {
      const [detailRes, dashRes] = await Promise.all([
        organizationAPI.get(orgId),
        organizationAPI.dashboard(orgId).catch(() => ({ data: null })),
      ]);
      const detail = detailRes.data || {};
      setOrgDetail(detail);
      setOrgPlayers(detail.players || []);
      setOrgStaff(detail.staff || []);
      setOrgDashboard(dashRes.data);
    } catch {
      setOrgDetail(null);
      setOrgPlayers([]);
      setOrgStaff([]);
      setOrgDashboard(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleExpand = (orgId) => {
    if (expandedOrgId === orgId) {
      setExpandedOrgId(null);
      setOrgDetail(null);
    } else {
      setExpandedOrgId(orgId);
      loadOrgDetail(orgId);
    }
  };

  // Create organization
  const handleCreateOrg = async () => {
    if (!createForm.name.trim()) {
      Alert.alert('Validation', 'Organization name is required.');
      return;
    }
    setCreateSaving(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        org_type: createForm.org_type,
        sports: createForm.sports.split(',').map(s => s.trim()).filter(Boolean),
        description: createForm.description.trim(),
        location: createForm.location.trim(),
        city: createForm.city.trim(),
        contact_email: createForm.contact_email.trim(),
        contact_phone: createForm.contact_phone.trim(),
      };
      await organizationAPI.create(payload);
      setCreateModalVisible(false);
      setCreateForm({
        name: '', org_type: 'individual_coach', sports: '', description: '',
        location: '', city: '', contact_email: '', contact_phone: '',
      });
      loadOrganizations();
      Alert.alert('Success', 'Organization created successfully.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create organization');
    } finally {
      setCreateSaving(false);
    }
  };

  // Search users
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await userSearchAPI.search(searchQuery.trim());
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Add player
  const handleAddPlayer = async (userId) => {
    if (!expandedOrgId) return;
    try {
      await organizationAPI.addPlayer(expandedOrgId, { user_id: userId });
      setAddPlayerModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      loadOrgDetail(expandedOrgId);
      loadOrganizations();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to add player');
    }
  };

  // Remove player
  const handleRemovePlayer = (userId) => {
    if (!expandedOrgId) return;
    Alert.alert('Remove Player', 'Remove this player from the organization?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await organizationAPI.removePlayer(expandedOrgId, userId);
            setOrgPlayers(prev => prev.filter(p => (p.id || p.user_id) !== userId));
            loadOrganizations();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to remove player');
          }
        },
      },
    ]);
  };

  // Add staff
  const handleAddStaff = async (userId) => {
    if (!expandedOrgId) return;
    try {
      await organizationAPI.addStaff(expandedOrgId, { user_id: userId });
      setAddStaffModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      loadOrgDetail(expandedOrgId);
      loadOrganizations();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to add staff');
    }
  };

  // Remove staff
  const handleRemoveStaff = (userId) => {
    if (!expandedOrgId) return;
    Alert.alert('Remove Staff', 'Remove this staff member from the organization?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await organizationAPI.removeStaff(expandedOrgId, userId);
            setOrgStaff(prev => prev.filter(s => (s.id || s.user_id) !== userId));
            loadOrganizations();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to remove staff');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderOrgCard = (org) => {
    const isExpanded = expandedOrgId === org.id;
    const sports = org.sports || [];
    const variant = ORG_TYPE_VARIANTS[org.org_type] || 'default';

    return (
      <View key={org.id}>
        <TouchableOpacity activeOpacity={0.75} onPress={() => handleToggleExpand(org.id)}>
          <Card style={styles.orgCard}>
            <View style={styles.orgCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orgName}>{org.name}</Text>
                <View style={styles.orgMetaRow}>
                  <Badge variant={variant}>{ORG_TYPE_LABELS[org.org_type] || org.org_type}</Badge>
                </View>
              </View>
              <Text style={styles.expandIcon}>{isExpanded ? '\u25B2' : '\u25BC'}</Text>
            </View>

            <View style={styles.orgCountsRow}>
              <View style={styles.orgCountItem}>
                <Text style={styles.orgCountIcon}>{'\uD83D\uDC65'}</Text>
                <Text style={styles.orgCountText}>{org.player_count || 0} Players</Text>
              </View>
              <View style={styles.orgCountItem}>
                <Text style={styles.orgCountIcon}>{'\uD83D\uDC54'}</Text>
                <Text style={styles.orgCountText}>{org.staff_count || 0} Staff</Text>
              </View>
            </View>

            {sports.length > 0 && (
              <View style={styles.sportsRow}>
                {sports.map((sport, idx) => (
                  <Badge key={idx} variant="amber" style={{ marginRight: Spacing.xs, marginBottom: Spacing.xs }}>
                    {sport}
                  </Badge>
                ))}
              </View>
            )}
          </Card>
        </TouchableOpacity>

        {isExpanded && (
          <Card style={styles.expandedCard}>
            {detailLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.detailLoadingText}>Loading details...</Text>
              </View>
            ) : (
              <View>
                {/* Stats */}
                {orgDashboard && (
                  <View style={styles.orgStatsGrid}>
                    <OrgStatBox
                      label="RECORDS"
                      value={orgDashboard.total_records || 0}
                      textIcon={'\uD83D\uDCCA'}
                      bg={Colors.primaryLight}
                      valueColor={Colors.primary}
                    />
                    <OrgStatBox
                      label="TRAINING"
                      value={orgDashboard.total_training_sessions || 0}
                      textIcon={'\uD83C\uDFAF'}
                      bg={Colors.emeraldLight}
                      valueColor={Colors.emerald}
                    />
                    <OrgStatBox
                      label="TOURNAMENTS"
                      value={orgDashboard.tournaments_organized || 0}
                      textIcon={'\uD83C\uDFC6'}
                      bg={Colors.amberLight}
                      valueColor={Colors.amber}
                    />
                  </View>
                )}

                {/* Players section */}
                <View style={styles.expandedSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{'\uD83D\uDC65'} Players ({orgPlayers.length})</Text>
                    <Button size="sm" variant="outline" onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setAddPlayerModalVisible(true);
                    }}>
                      + Add
                    </Button>
                  </View>
                  {orgPlayers.length === 0 ? (
                    <Text style={styles.emptyText}>No players yet. Add players by searching their email.</Text>
                  ) : (
                    <View style={{ gap: Spacing.xs }}>
                      {orgPlayers.map((p, i) => (
                        <MemberRow key={p.id || p.user_id || i} member={p} onRemove={handleRemovePlayer} roleLabel="Player" />
                      ))}
                    </View>
                  )}
                </View>

                {/* Staff section */}
                <View style={styles.expandedSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{'\uD83D\uDC54'} Staff ({orgStaff.length})</Text>
                    <Button size="sm" variant="outline" onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setAddStaffModalVisible(true);
                    }}>
                      + Add
                    </Button>
                  </View>
                  {orgStaff.length === 0 ? (
                    <Text style={styles.emptyText}>No staff members yet.</Text>
                  ) : (
                    <View style={{ gap: Spacing.xs }}>
                      {orgStaff.map((s, i) => (
                        <MemberRow key={s.id || s.user_id || i} member={s} onRemove={handleRemoveStaff} roleLabel="Staff" />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </Card>
        )}
      </View>
    );
  };

  const renderSearchModal = (visible, onClose, onSelect, title) => (
    <ModalSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.searchRow}>
        <Input
          label="Search by email or name"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="user@email.com"
          keyboardType="email-address"
          style={{ flex: 1, marginBottom: 0 }}
        />
        <Button size="sm" onPress={handleSearch} loading={searching} style={{ marginTop: Spacing.lg, marginLeft: Spacing.sm }}>
          Search
        </Button>
      </View>
      {searchResults.length > 0 && (
        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          {searchResults.map((u, i) => (
            <TouchableOpacity key={u.id || i} style={styles.searchResultRow} onPress={() => onSelect(u.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{u.name || u.email}</Text>
                {u.email && <Text style={styles.memberEmail}>{u.email}</Text>}
              </View>
              <Text style={{ color: Colors.primary, fontSize: Typography.xs, fontFamily: Typography.fontBodyBold }}>ADD</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {searchResults.length === 0 && searchQuery.trim().length > 0 && !searching && (
        <Text style={[styles.emptyText, { marginTop: Spacing.md }]}>No users found. Try a different search term.</Text>
      )}
    </ModalSheet>
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
            <Text style={styles.headerTitle}>{'\uD83C\uDFE2'} My Organizations</Text>
          </View>
          <Button size="sm" onPress={() => setCreateModalVisible(true)}>
            + New
          </Button>
        </View>

        {/* Organization List */}
        {organizations.length === 0 ? (
          <EmptyState
            icon={'\uD83C\uDFE2'}
            title="No organizations"
            subtitle="Create an organization to manage your players, staff, and training programs."
            actionLabel="Create Organization"
            onAction={() => setCreateModalVisible(true)}
          />
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {organizations.map(renderOrgCard)}
          </View>
        )}
      </ScrollView>

      {/* Create Organization Modal */}
      <ModalSheet visible={createModalVisible} onClose={() => setCreateModalVisible(false)} title="Create Organization">
        <Input
          label="Organization Name"
          value={createForm.name}
          onChangeText={(v) => setCreateForm(prev => ({ ...prev, name: v }))}
          placeholder="e.g. Elite Sports Academy"
        />
        <Text style={styles.formLabel}>Organization Type</Text>
        <View style={styles.typeGrid}>
          {ORG_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, createForm.org_type === type && styles.typeChipActive]}
              onPress={() => setCreateForm(prev => ({ ...prev, org_type: type }))}
            >
              <Text style={[styles.typeChipText, createForm.org_type === type && styles.typeChipTextActive]}>
                {ORG_TYPE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input
          label="Sports (comma-separated)"
          value={createForm.sports}
          onChangeText={(v) => setCreateForm(prev => ({ ...prev, sports: v }))}
          placeholder="e.g. Cricket, Badminton, Football"
        />
        <Input
          label="Description"
          value={createForm.description}
          onChangeText={(v) => setCreateForm(prev => ({ ...prev, description: v }))}
          placeholder="About your organization..."
          multiline
          numberOfLines={3}
        />
        <Input
          label="Location"
          value={createForm.location}
          onChangeText={(v) => setCreateForm(prev => ({ ...prev, location: v }))}
          placeholder="e.g. Sports Complex, Andheri West"
        />
        <Input
          label="City"
          value={createForm.city}
          onChangeText={(v) => setCreateForm(prev => ({ ...prev, city: v }))}
          placeholder="e.g. Mumbai"
        />
        <Input
          label="Contact Email"
          value={createForm.contact_email}
          onChangeText={(v) => setCreateForm(prev => ({ ...prev, contact_email: v }))}
          placeholder="contact@academy.com"
          keyboardType="email-address"
        />
        <Input
          label="Contact Phone"
          value={createForm.contact_phone}
          onChangeText={(v) => setCreateForm(prev => ({ ...prev, contact_phone: v }))}
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
        />
        <Button onPress={handleCreateOrg} loading={createSaving} style={{ marginTop: Spacing.md }}>
          Create Organization
        </Button>
      </ModalSheet>

      {/* Add Player Modal */}
      {renderSearchModal(addPlayerModalVisible, () => setAddPlayerModalVisible(false), handleAddPlayer, 'Add Player')}

      {/* Add Staff Modal */}
      {renderSearchModal(addStaffModalVisible, () => setAddStaffModalVisible(false), handleAddStaff, 'Add Staff')}
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

  // Org card
  orgCard: { padding: Spacing.md },
  orgCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orgName: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.xs },
  orgMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  expandIcon: { fontSize: Typography.xs, color: Colors.mutedForeground, marginTop: 4 },
  orgCountsRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md },
  orgCountItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  orgCountIcon: { fontSize: 14 },
  orgCountText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  sportsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md },

  // Expanded detail
  expandedCard: { padding: Spacing.md, marginTop: Spacing.xs, borderTopWidth: 0 },
  expandedSection: { marginTop: Spacing.lg },
  detailLoading: { alignItems: 'center', paddingVertical: Spacing.xl },
  detailLoadingText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: Spacing.sm },

  // Org stats
  orgStatsGrid: { flexDirection: 'row', gap: Spacing.sm },
  orgStatBox: { flex: 1, backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, padding: Spacing.md, alignItems: 'center' },
  orgStatIconBox: { width: 32, height: 32, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  orgStatValue: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  orgStatLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  memberEmail: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'flex-end' },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, borderWidth: 1, borderColor: Colors.border },

  // Form
  formLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  typeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  typeChipText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  typeChipTextActive: { color: Colors.primary },

  emptyText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
});
