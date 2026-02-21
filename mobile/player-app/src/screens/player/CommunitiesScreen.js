import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { groupAPI, recommendationAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SearchBar from '../../components/common/SearchBar';
import FilterChips from '../../components/common/FilterChips';
import TabBar from '../../components/common/TabBar';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'discover', label: 'Discover' },
  { key: 'my_groups', label: 'My Groups' },
];

const SPORT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'football', label: 'Football' },
  { key: 'cricket', label: 'Cricket' },
  { key: 'basketball', label: 'Basketball' },
  { key: 'badminton', label: 'Badminton' },
  { key: 'tennis', label: 'Tennis' },
];

const SPORT_EMOJIS = {
  football: '⚽',
  cricket: '🏏',
  basketball: '🏀',
  badminton: '🏸',
  tennis: '🎾',
  volleyball: '🏐',
  default: '🏆',
};

const SPORT_OPTIONS = ['Football', 'Cricket', 'Basketball', 'Badminton', 'Tennis', 'Volleyball'];
const TYPE_OPTIONS = ['community', 'club'];

function getSportEmoji(sport) {
  if (!sport) return SPORT_EMOJIS.default;
  return SPORT_EMOJIS[sport.toLowerCase()] || SPORT_EMOJIS.default;
}

// ─── Group Card ─────────────────────────────────────────────────────────────
function GroupCard({ group, isMember, onJoin, onLeave, onPress, loading }) {
  const emoji = getSportEmoji(group.sport);
  const memberCount = group.member_count || group.members?.length || 0;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.groupCard}>
        <View style={styles.groupCardTop}>
          <View style={styles.groupAvatar}>
            <Text style={styles.groupAvatarEmoji}>{emoji}</Text>
          </View>
          <View style={styles.groupCardInfo}>
            <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
            {group.description ? (
              <Text style={styles.groupDesc} numberOfLines={2}>{group.description}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.groupMeta}>
          <Text style={styles.groupMembers}>
            👥 {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </Text>
          <View style={styles.groupBadges}>
            {group.sport ? (
              <Badge variant="default">{group.sport}</Badge>
            ) : null}
            <Badge variant={group.is_private ? 'amber' : 'secondary'}>
              {group.is_private ? 'Private' : 'Public'}
            </Badge>
          </View>
        </View>

        <View style={styles.groupCardFooter}>
          {isMember ? (
            <Button
              size="sm"
              variant="outline"
              onPress={onLeave}
              loading={loading}
            >
              Leave
            </Button>
          ) : (
            <Button
              size="sm"
              onPress={onJoin}
              loading={loading}
            >
              Join
            </Button>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Recommended Section ────────────────────────────────────────────────────
function RecommendedSection({ groups, myGroupIds, onJoin, onLeave, onPress, actionLoading }) {
  if (!groups || groups.length === 0) return null;

  return (
    <View style={styles.recommendedSection}>
      <View style={styles.recommendedHeader}>
        <Text style={styles.recommendedLabel}>AI RECOMMENDED</Text>
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedBadgeText}>For You</Text>
        </View>
      </View>
      <FlatList
        data={groups}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id?.toString()}
        contentContainerStyle={{ paddingHorizontal: Spacing.base, gap: Spacing.md }}
        renderItem={({ item }) => {
          const isMember = myGroupIds.has(item.id);
          return (
            <View style={styles.recommendedCard}>
              <GroupCard
                group={item}
                isMember={isMember}
                onJoin={() => onJoin(item.id)}
                onLeave={() => onLeave(item.id)}
                onPress={() => onPress(item.id)}
                loading={actionLoading === item.id}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

// ─── Create Group Modal ─────────────────────────────────────────────────────
function CreateGroupContent({ onCreated, onClose }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    sport: 'Football',
    type: 'community',
    is_private: false,
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    setCreating(true);
    try {
      await groupAPI.create({
        name: form.name.trim(),
        description: form.description.trim(),
        sport: form.sport.toLowerCase(),
        type: form.type,
        is_private: form.is_private,
      });
      Alert.alert('Success', 'Group created successfully!');
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View>
      <Input
        label="Group Name"
        value={form.name}
        onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
        placeholder="e.g. Weekend Warriors"
        autoCapitalize="words"
      />
      <Input
        label="Description"
        value={form.description}
        onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
        placeholder="What is this group about?"
        autoCapitalize="sentences"
        multiline
      />

      <Text style={styles.formLabel}>Sport</Text>
      <View style={styles.sportGrid}>
        {SPORT_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sportChip, form.sport === s && styles.sportChipActive]}
            onPress={() => setForm((p) => ({ ...p, sport: s }))}
          >
            <Text style={styles.sportChipEmoji}>{getSportEmoji(s)}</Text>
            <Text style={[styles.sportChipText, form.sport === s && styles.sportChipTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.formLabel}>Type</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeChip, form.type === t && styles.typeChipActive]}
            onPress={() => setForm((p) => ({ ...p, type: t }))}
          >
            <Text style={[styles.typeChipText, form.type === t && styles.typeChipTextActive]}>
              {t === 'community' ? 'Community' : 'Club'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Private Group</Text>
          <Text style={styles.switchSubtext}>Members need approval to join</Text>
        </View>
        <Switch
          value={form.is_private}
          onValueChange={(v) => setForm((p) => ({ ...p, is_private: v }))}
          trackColor={{ false: Colors.secondary, true: Colors.primaryLight }}
          thumbColor={form.is_private ? Colors.primary : Colors.mutedForeground}
        />
      </View>

      <Button onPress={handleCreate} loading={creating} style={{ marginTop: Spacing.md }}>
        Create Group
      </Button>
    </View>
  );
}

// ─── Main CommunitiesScreen ─────────────────────────────────────────────────
export default function CommunitiesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [createVisible, setCreateVisible] = useState(false);

  const [discoverGroups, setDiscoverGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [myGroupIds, setMyGroupIds] = useState(new Set());

  // ── Load data ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedSport !== 'all') params.sport = selectedSport;

      const [discoverRes, myRes, recRes] = await Promise.all([
        groupAPI.list(params).catch(() => ({ data: [] })),
        groupAPI.myGroups().catch(() => ({ data: [] })),
        recommendationAPI.groups(5).catch(() => ({ data: [] })),
      ]);

      setDiscoverGroups(discoverRes.data || []);
      const myData = myRes.data || [];
      setMyGroups(myData);
      setMyGroupIds(new Set(myData.map((g) => g.id)));
      setRecommended(recRes.data || []);
    } catch (err) {
      if (!refreshing) {
        Alert.alert('Error', 'Failed to load communities');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedSport, refreshing]);

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedSport]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── Join / Leave ────────────────────────────────────────────────────────
  const handleJoin = async (groupId) => {
    setActionLoading(groupId);
    try {
      await groupAPI.join(groupId);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to join group');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = async (groupId) => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(groupId);
          try {
            await groupAPI.leave(groupId);
            await loadData();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to leave group');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleGroupPress = (groupId) => {
    navigation.navigate('GroupDetail', { groupId });
  };

  // ── Render list items ───────────────────────────────────────────────────
  const renderGroupItem = ({ item }) => (
    <GroupCard
      group={item}
      isMember={myGroupIds.has(item.id)}
      onJoin={() => handleJoin(item.id)}
      onLeave={() => handleLeave(item.id)}
      onPress={() => handleGroupPress(item.id)}
      loading={actionLoading === item.id}
    />
  );

  const currentList = activeTab === 'discover' ? discoverGroups : myGroups;

  const ListHeaderDiscover = () => (
    <View>
      <RecommendedSection
        groups={recommended}
        myGroupIds={myGroupIds}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onPress={handleGroupPress}
        actionLoading={actionLoading}
      />
      {discoverGroups.length > 0 && (
        <Text style={styles.sectionTitle}>All Communities</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>YOUR</Text>
          <Text style={styles.headerTitle}>Communities</Text>
        </View>
        <Button size="sm" onPress={() => setCreateVisible(true)}>+ Create</Button>
      </View>

      {/* Tabs */}
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Discover: Search + Filter */}
      {activeTab === 'discover' && (
        <View>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search communities..."
            style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.sm }}
          />
          <FilterChips
            items={SPORT_FILTERS}
            selected={selectedSport}
            onSelect={setSelectedSport}
            style={{ marginBottom: Spacing.md }}
          />
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderGroupItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={
            currentList.length === 0
              ? { flex: 1 }
              : { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3, gap: Spacing.md }
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={activeTab === 'discover' ? ListHeaderDiscover : null}
          ListEmptyComponent={
            <EmptyState
              icon={activeTab === 'discover' ? '🔍' : '👥'}
              title={activeTab === 'discover' ? 'No communities found' : 'No groups joined yet'}
              subtitle={
                activeTab === 'discover'
                  ? 'Try adjusting your search or filters'
                  : 'Discover and join communities to connect with other players'
              }
              actionLabel={activeTab === 'my_groups' ? 'Discover Groups' : undefined}
              onAction={activeTab === 'my_groups' ? () => setActiveTab('discover') : undefined}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreateVisible(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create Group Modal */}
      <ModalSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        title="Create Group"
      >
        <CreateGroupContent onCreated={loadData} onClose={() => setCreateVisible(false)} />
      </ModalSheet>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // ── Recommended Section ─────────────────────────────────────────────────
  recommendedSection: {
    marginBottom: Spacing.md,
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  recommendedLabel: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recommendedBadge: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Spacing.radiusFull,
  },
  recommendedBadgeText: {
    fontSize: 9,
    fontFamily: Typography.fontBodyBold,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recommendedCard: {
    width: 260,
  },

  // ── Group Card ──────────────────────────────────────────────────────────
  groupCard: {
    padding: Spacing.base,
  },
  groupCardTop: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupAvatarEmoji: {
    fontSize: 22,
  },
  groupCardInfo: {
    flex: 1,
    gap: 4,
  },
  groupName: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  groupDesc: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    lineHeight: 16,
  },
  groupMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  groupMembers: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  groupBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  groupCardFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    alignItems: 'flex-end',
  },

  // ── Create Group Form ───────────────────────────────────────────────────
  formLabel: {
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
    marginBottom: Spacing.lg,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
  sportChipEmoji: {
    fontSize: 14,
  },
  sportChipText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
  },
  sportChipTextActive: {
    color: Colors.primary,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  typeChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
  },
  typeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  typeChipText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeChipTextActive: {
    color: Colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  switchLabel: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  switchSubtext: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginTop: 2,
  },

  // ── FAB ─────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl2,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.primaryForeground,
    lineHeight: 30,
  },
});
