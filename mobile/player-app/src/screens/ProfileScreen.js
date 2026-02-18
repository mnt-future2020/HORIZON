import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Image, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI, bookingAPI, authAPI, uploadAPI } from '../api';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

function getRatingTier(r) {
  if (r >= 2500) return { label: 'Diamond', color: Colors.tierDiamond, bg: Colors.cyanLight };
  if (r >= 2000) return { label: 'Gold', color: Colors.tierGold, bg: Colors.amberLight };
  if (r >= 1500) return { label: 'Silver', color: Colors.tierSilver, bg: Colors.slateLight };
  return { label: 'Bronze', color: Colors.tierBronze, bg: Colors.orangeLight };
}

const TABS = ['overview', 'edit'];

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const navigation = useNavigation();
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', preferred_position: '' });

  const loadData = async () => {
    try {
      const [sRes, bRes] = await Promise.all([
        analyticsAPI.player().catch(() => ({ data: null })),
        bookingAPI.list().catch(() => ({ data: [] })),
      ]);
      setStats(sRes.data);
      setBookings(bRes.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', phone: user.phone || '', preferred_position: user.preferred_position || '' });
    }
    loadData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authAPI.updateProfile(form);
      updateUser(res.data);
      Alert.alert('Success', 'Profile updated!');
      setActiveTab('overview');
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async () => {
    Alert.alert('Update Photo', 'Choose source', [
      {
        text: 'Camera', onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera permission is required');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) uploadAvatar(result.assets[0]);
        }
      },
      {
        text: 'Gallery', onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Gallery permission is required');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) uploadAvatar(result.assets[0]);
        }
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadAvatar = async (asset) => {
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'avatar.jpg' });
      const res = await uploadAPI.image(formData);
      const url = res.data.url;
      const profileRes = await authAPI.updateProfile({ avatar: url });
      updateUser(profileRes.data);
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err) {
      Alert.alert('Error', err?.response?.status === 503 ? 'S3 not configured. Contact admin.' : 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const tier = getRatingTier(user?.skill_rating || 1500);
  const totalBookings = bookings.length;
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handleAvatarChange} style={styles.avatarWrapper}>
            {uploadingAvatar ? (
              <View style={styles.avatarPlaceholder}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>

          <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
            <Text style={[styles.tierText, { color: tier.color }]}>
              {tier.label} • {user?.skill_rating || 1500}
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Games', value: user?.total_games || 0, color: Colors.violet },
            { label: 'Wins', value: user?.wins || 0, color: Colors.primary },
            { label: 'Bookings', value: totalBookings, color: Colors.sky },
          ].map((s, i) => (
            <View key={i} style={styles.statBox}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeTab === t && styles.tabActive]}
              onPress={() => setActiveTab(t)}
            >
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t === 'overview' ? 'Overview' : 'Edit Profile'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' ? (
          <View style={styles.tabContent}>
            {/* Rating Card */}
            <Card style={styles.ratingCard}>
              <Text style={styles.cardTitle}>Skill Rating</Text>
              <View style={styles.ratingRow}>
                <Text style={[styles.ratingScore, { color: tier.color }]}>{user?.skill_rating || 1500}</Text>
                <View>
                  <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
                  <Text style={styles.ratingDesc}>
                    Win Rate: {user?.total_games ? `${Math.round(((user?.wins || 0) / user.total_games) * 100)}%` : 'N/A'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Info */}
            <Card>
              <Text style={styles.cardTitle}>Player Info</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
              {user?.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{user.phone}</Text>
                </View>
              )}
              {user?.preferred_position && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Position</Text>
                  <Text style={styles.infoValue}>{user.preferred_position}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role</Text>
                <Badge variant="secondary">{user?.role || 'player'}</Badge>
              </View>
            </Card>
          </View>
        ) : (
          <View style={styles.tabContent}>
            <Card>
              <Text style={styles.cardTitle}>Edit Profile</Text>
              <Input
                label="Full Name"
                value={form.name}
                onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="Your name"
                autoCapitalize="words"
              />
              <Input
                label="Phone"
                value={form.phone}
                onChangeText={v => setForm(p => ({ ...p, phone: v }))}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
              />
              <Input
                label="Preferred Position"
                value={form.preferred_position}
                onChangeText={v => setForm(p => ({ ...p, preferred_position: v }))}
                placeholder="e.g. Striker, Goalkeeper"
                autoCapitalize="words"
              />
              <Button onPress={handleSave} loading={saving} style={{ marginTop: Spacing.sm }}>
                Save Changes
              </Button>
            </Card>
          </View>
        )}

        {/* Logout */}
        <View style={styles.logoutSection}>
          <Button variant="destructive" onPress={handleLogout} style={{ width: '100%' }}>
            Log Out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  profileHeader: { alignItems: 'center', paddingVertical: Spacing.xl2, paddingHorizontal: Spacing.base },
  avatarWrapper: { position: 'relative', marginBottom: Spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.primary },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.border },
  avatarInitial: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.background },
  profileName: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  profileEmail: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
  tierBadge: { marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Spacing.radiusFull },
  tierText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold },
  statsRow: { flexDirection: 'row', marginHorizontal: Spacing.base, backgroundColor: Colors.card, borderRadius: Spacing.radiusLg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.base },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRightWidth: 1, borderRightColor: Colors.border },
  statValue: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack },
  statLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  tabBar: { flexDirection: 'row', marginHorizontal: Spacing.base, backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, padding: 3, marginBottom: Spacing.base },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Spacing.radiusSm },
  tabActive: { backgroundColor: Colors.card },
  tabText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  tabTextActive: { color: Colors.foreground },
  tabContent: { paddingHorizontal: Spacing.base, gap: Spacing.md },
  ratingCard: { marginBottom: 0 },
  cardTitle: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.md },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ratingScore: { fontSize: Typography.xl5, fontFamily: Typography.fontDisplayBlack },
  tierLabel: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold },
  ratingDesc: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  infoValue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, textAlign: 'right', flex: 1, marginLeft: Spacing.sm },
  logoutSection: { margin: Spacing.base, marginTop: Spacing.xl },
});
