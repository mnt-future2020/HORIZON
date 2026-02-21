import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Share, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../contexts/AuthContext';
import { socialAPI, userSearchAPI } from '../../api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SearchBar from '../../components/common/SearchBar';
import TabBar from '../../components/common/TabBar';
import UserRow from '../../components/common/UserRow';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'sync', label: 'Sync' },
  { key: 'search', label: 'Search' },
  { key: 'invite', label: 'Invite' },
];

export default function ContactSyncScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('sync');

  // Sync state
  const [phoneInput, setPhoneInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [matchedUsers, setMatchedUsers] = useState([]);
  const [syncDone, setSyncDone] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Invite state
  const [inviteLink, setInviteLink] = useState('');
  const [loadingLink, setLoadingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  // Follow state
  const [followStates, setFollowStates] = useState({});

  const handleSync = async () => {
    if (!phoneInput.trim()) {
      Alert.alert('Enter Phone Numbers', 'Enter comma-separated phone numbers to find friends on Horizon.');
      return;
    }
    setSyncing(true);
    try {
      const phones = phoneInput.split(',').map(p => p.trim()).filter(Boolean);
      const res = await socialAPI.syncContacts({ phones });
      const matched = res.data?.matched_users || res.data?.matches || res.data || [];
      setMatchedUsers(Array.isArray(matched) ? matched : []);
      setSyncDone(true);
    } catch (err) {
      Alert.alert('Sync Error', 'Failed to sync contacts. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await userSearchAPI.search(searchQuery.trim());
      const results = res.data?.users || res.data || [];
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      Alert.alert('Search Error', 'Failed to search users.');
    } finally {
      setSearching(false);
    }
  };

  const handleGetInviteLink = async () => {
    setLoadingLink(true);
    try {
      const res = await socialAPI.getInviteLink();
      const link = res.data?.link || res.data?.invite_link || res.data?.url || '';
      setInviteLink(link);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate invite link.');
    } finally {
      setLoadingLink(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await Clipboard.setStringAsync(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy link.');
    }
  };

  const handleShare = async () => {
    if (!inviteLink) return;
    try {
      await Share.share({
        message: `Join me on Horizon! ${inviteLink}`,
        url: inviteLink,
      });
    } catch (err) {
      // User cancelled share
    }
  };

  const handleFollow = async (targetUserId) => {
    setFollowStates(prev => ({ ...prev, [targetUserId]: { ...prev[targetUserId], loading: true } }));
    try {
      await socialAPI.toggleFollow(targetUserId);
      setFollowStates(prev => ({
        ...prev,
        [targetUserId]: {
          following: !prev[targetUserId]?.following,
          loading: false,
        },
      }));
    } catch (err) {
      setFollowStates(prev => ({ ...prev, [targetUserId]: { ...prev[targetUserId], loading: false } }));
    }
  };

  const renderUserActions = (targetUser) => {
    const state = followStates[targetUser.id] || {};
    return (
      <View style={styles.userActions}>
        <Button
          variant={state.following ? 'outline' : 'primary'}
          size="sm"
          onPress={() => handleFollow(targetUser.id)}
          loading={state.loading}
          style={{ marginRight: Spacing.sm }}
        >
          {state.following ? 'Following' : 'Follow'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => navigation.navigate('Chat', { userId: targetUser.id })}
        >
          Message
        </Button>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Friends</Text>
        <View style={{ width: 60 }} />
      </View>

      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'sync' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner} showsVerticalScrollIndicator={false}>
          <Card>
            <Text style={styles.cardTitle}>Sync Your Contacts</Text>
            <Text style={styles.cardDesc}>
              Enter phone numbers (comma-separated) to find friends already on Horizon.
            </Text>
            <Input
              label="Phone Numbers"
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="+91 98765 43210, +91 87654 32109"
              keyboardType="phone-pad"
              multiline
            />
            <Button
              onPress={handleSync}
              loading={syncing}
              style={{ marginTop: Spacing.md }}
            >
              Sync Contacts
            </Button>
          </Card>

          {syncDone && matchedUsers.length > 0 && (
            <View style={styles.resultsSection}>
              <View style={styles.resultHeader}>
                <Text style={styles.sectionTitle}>Friends on Horizon</Text>
                <Badge variant="default">{matchedUsers.length} found</Badge>
              </View>
              {matchedUsers.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  subtitle={u.skill_rating ? `Rating: ${u.skill_rating}` : u.email}
                  onPress={() => navigation.navigate('PlayerCard', { userId: u.id })}
                  rightComponent={renderUserActions(u)}
                />
              ))}
            </View>
          )}

          {syncDone && matchedUsers.length === 0 && (
            <EmptyState
              icon="👥"
              title="No matches found"
              subtitle="None of the entered phone numbers are registered on Horizon yet. Invite them!"
              actionLabel="Go to Invite"
              onAction={() => setActiveTab('invite')}
              style={{ marginTop: Spacing.base }}
            />
          )}
        </ScrollView>
      )}

      {activeTab === 'search' && (
        <View style={styles.tabContent}>
          <View style={styles.searchSection}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={handleSearch}
              placeholder="Search by name or email..."
              style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.md }}
            />
          </View>

          {searching ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id?.toString()}
              renderItem={({ item }) => (
                <UserRow
                  user={item}
                  subtitle={item.skill_rating ? `Rating: ${item.skill_rating}` : item.email}
                  onPress={() => navigation.navigate('PlayerCard', { userId: item.id })}
                  rightComponent={
                    <Button
                      variant={followStates[item.id]?.following ? 'outline' : 'primary'}
                      size="sm"
                      onPress={() => handleFollow(item.id)}
                      loading={followStates[item.id]?.loading}
                    >
                      {followStates[item.id]?.following ? 'Following' : 'Follow'}
                    </Button>
                  }
                />
              )}
              contentContainerStyle={{ paddingBottom: Spacing.xl3 }}
            />
          ) : searchQuery.trim() ? (
            <EmptyState
              icon="🔍"
              title="No users found"
              subtitle={`No results for "${searchQuery}"`}
            />
          ) : (
            <EmptyState
              icon="🔍"
              title="Search for players"
              subtitle="Find friends by name or email"
            />
          )}
        </View>
      )}

      {activeTab === 'invite' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner} showsVerticalScrollIndicator={false}>
          <Card>
            <Text style={styles.cardTitle}>Invite Friends</Text>
            <Text style={styles.cardDesc}>
              Share your unique invite link with friends to get them on Horizon.
            </Text>

            {!inviteLink ? (
              <Button
                onPress={handleGetInviteLink}
                loading={loadingLink}
                style={{ marginTop: Spacing.md }}
              >
                Generate Invite Link
              </Button>
            ) : (
              <View style={styles.inviteLinkSection}>
                <View style={styles.linkBox}>
                  <Text style={styles.linkText} numberOfLines={2}>{inviteLink}</Text>
                </View>
                <View style={styles.linkActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={handleCopy}
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={handleShare}
                    style={{ flex: 1 }}
                  >
                    Share
                  </Button>
                </View>
              </View>
            )}
          </Card>

          <Card style={{ marginTop: Spacing.md }}>
            <View style={styles.inviteStatsRow}>
              <Text style={styles.inviteIcon}>🎯</Text>
              <View>
                <Text style={styles.inviteStatsValue}>
                  {matchedUsers.length} friends found on Horizon
                </Text>
                <Text style={styles.inviteStatsLabel}>
                  Invite more friends to play together
                </Text>
              </View>
            </View>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.base },
  backBtn: { width: 60 },
  backText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  headerTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  tabContent: { flex: 1 },
  tabContentInner: { padding: Spacing.base, paddingBottom: Spacing.xl3 },

  cardTitle: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginBottom: Spacing.xs },
  cardDesc: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginBottom: Spacing.md, lineHeight: 20 },

  resultsSection: { marginTop: Spacing.xl },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },

  userActions: { flexDirection: 'row', alignItems: 'center' },

  searchSection: { marginTop: Spacing.sm },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: Spacing.xl3 },

  inviteLinkSection: { marginTop: Spacing.md },
  linkBox: {
    backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md,
  },
  linkText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.primary },
  linkActions: { flexDirection: 'row' },

  inviteStatsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  inviteIcon: { fontSize: 28 },
  inviteStatsValue: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  inviteStatsLabel: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
});
