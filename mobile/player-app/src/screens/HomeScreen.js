import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { bookingAPI, analyticsAPI } from '../api';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

function getRatingTier(r) {
  if (r >= 2500) return { label: 'Diamond', color: Colors.tierDiamond };
  if (r >= 2000) return { label: 'Gold', color: Colors.tierGold };
  if (r >= 1500) return { label: 'Silver', color: Colors.tierSilver };
  return { label: 'Bronze', color: Colors.tierBronze };
}

function StatCard({ label, value, valueColor, bg, textIcon }) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 14 }}>{textIcon}</Text>
      </View>
      <Text style={[styles.statValue, { color: valueColor || Colors.foreground }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function BookingCard({ booking, onPress }) {
  const badgeVariant =
    booking.status === 'confirmed' ? 'default' :
    booking.status === 'pending' ? 'secondary' : 'destructive';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <Card style={styles.bookingCard}>
        <View style={styles.bookingRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <View style={styles.bookingHeader}>
              <Text style={styles.bookingVenue} numberOfLines={1}>
                {booking.venue_name || 'Venue'}
              </Text>
              <Badge variant={badgeVariant} style={{ marginLeft: 6 }}>
                {booking.status}
              </Badge>
            </View>
            <View style={styles.bookingMeta}>
              <Text style={styles.bookingMetaText}>📅 {booking.date}</Text>
              <Text style={styles.bookingMetaText}>  🕐 {booking.start_time}–{booking.end_time}</Text>
            </View>
          </View>
          <Text style={styles.bookingAmount}>
            ₹{(booking.total_amount || 0).toLocaleString('en-IN')}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  const loadData = async () => {
    try {
      const [bRes, sRes] = await Promise.all([
        bookingAPI.list().catch(() => ({ data: [] })),
        analyticsAPI.player().catch(() => ({ data: null })),
      ]);
      setBookings(bRes.data || []);
      setStats(sRes.data);
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

  const today = new Date(new Date().toDateString());
  const upcoming = bookings.filter(b => b.status !== 'cancelled' && new Date(b.date) >= today);
  const past = bookings.filter(b => new Date(b.date) < today);
  const tier = getRatingTier(user?.skill_rating || 1500);

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
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSub}>DASHBOARD</Text>
          <Text style={styles.headerTitle}>
            Welcome back, <Text style={{ color: Colors.primary }}>{user?.name?.split(' ')[0]}</Text>
          </Text>
          <Text style={[styles.tierBadge, { color: tier.color }]}>
            {tier.label} Tier • {user?.skill_rating || 1500}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            label="SKILL RATING"
            value={<Text style={{ color: tier.color, fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack }}>{user?.skill_rating || 1500}</Text>}
            bg={Colors.primaryLight}
            textIcon="🏆"
          />
          <StatCard
            label="GAMES"
            value={user?.total_games || 0}
            valueColor={Colors.violet}
            bg={Colors.violetLight}
            textIcon="🎮"
          />
          <StatCard
            label="WIN RATE"
            value={user?.total_games ? `${Math.round(((user?.wins || 0) / user.total_games) * 100)}%` : '0%'}
            valueColor={Colors.amber}
            bg={Colors.amberLight}
            textIcon="⭐"
          />
          <StatCard
            label="UPCOMING"
            value={upcoming.length}
            valueColor={Colors.sky}
            bg={Colors.skyLight}
            textIcon="📅"
          />
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Venues', { search: searchQ })}
          activeOpacity={1}
        >
          <Card style={styles.searchCard} padding={false}>
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <Text style={styles.searchPlaceholder}>Search venue, area, or city...</Text>
            </View>
          </Card>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          {[
            { icon: '📍', label: 'Find Venue', desc: 'Browse available turfs', color: Colors.primaryLight, textColor: Colors.primary, screen: 'Venues' },
            { icon: '⚔️', label: 'Find Game', desc: 'Join or create matches', color: Colors.violetLight, textColor: Colors.violet, screen: 'Matchmaking' },
            { icon: '🏆', label: 'My Profile', desc: 'Stats & match history', color: Colors.amberLight, textColor: Colors.amber, screen: 'Profile' },
          ].map((a, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.actionBtn, { borderColor: Colors.border }]}
              onPress={() => navigation.navigate(a.screen)}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color }]}>
                <Text style={{ fontSize: 18 }}>{a.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionDesc}>{a.desc}</Text>
              </View>
              <Text style={{ color: Colors.mutedForeground }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
            {upcoming.length > 3 && (
              <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          {upcoming.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>No upcoming bookings</Text>
              <Button
                onPress={() => navigation.navigate('Venues')}
                style={{ marginTop: Spacing.md, alignSelf: 'center' }}
                size="sm"
              >
                Book a Venue
              </Button>
            </Card>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {upcoming.slice(0, 5).map(b => (
                <BookingCard key={b.id} booking={b} onPress={() => navigation.navigate('Bookings')} />
              ))}
            </View>
          )}
        </View>

        {/* Recent Games */}
        {past.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Games</Text>
            <View style={{ gap: Spacing.sm }}>
              {past.slice(0, 3).map(b => (
                <BookingCard key={b.id} booking={b} onPress={() => navigation.navigate('Bookings')} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  header: { marginTop: Spacing.base, marginBottom: Spacing.xl },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: Typography.widest },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },
  tierBadge: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  statCard: { width: '47.5%', padding: Spacing.md },
  statIconBox: { width: 36, height: 36, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  statLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  searchCard: { marginBottom: Spacing.base },
  searchRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  searchIcon: { marginRight: Spacing.sm, fontSize: 16 },
  searchPlaceholder: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  actionsGrid: { gap: Spacing.sm, marginBottom: Spacing.xl },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.card, borderRadius: Spacing.radiusLg, borderWidth: 1, gap: Spacing.md },
  actionIcon: { width: 40, height: 40, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  actionDesc: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  viewAll: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xl2 },
  emptyIcon: { fontSize: 32, marginBottom: Spacing.md },
  emptyText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  bookingCard: { padding: Spacing.md },
  bookingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bookingVenue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, flex: 1 },
  bookingMeta: { flexDirection: 'row', flexWrap: 'wrap' },
  bookingMetaText: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  bookingAmount: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
});
