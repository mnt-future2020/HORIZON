import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { bookingAPI, analyticsAPI, waitlistAPI, recommendationAPI, coachingAPI } from '../api';
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

function BookingCard({ booking, onPress, onGetQR }) {
  const isPast = new Date(booking.date) < new Date(new Date().toDateString());
  const isUpcoming = !isPast && booking.status === 'confirmed';
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
              {booking.checked_in && (
                <Badge variant="default" style={{ marginLeft: 4 }}>Checked In</Badge>
              )}
            </View>
            <View style={styles.bookingMeta}>
              <Text style={styles.bookingMetaText}>📅 {booking.date}</Text>
              <Text style={styles.bookingMetaText}>  🕐 {booking.start_time}–{booking.end_time}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={styles.bookingAmount}>
              ₹{(booking.total_amount || 0).toLocaleString('en-IN')}
            </Text>
            {isUpcoming && !booking.checked_in && onGetQR && (
              <TouchableOpacity
                onPress={(e) => { onGetQR(booking.id); }}
                style={styles.qrBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.qrBtnText}>📱 QR Check-in</Text>
              </TouchableOpacity>
            )}
            {booking.payment_mode === 'split' && (
              <Badge variant="secondary" style={{ marginTop: 2 }}>
                SPLIT {booking.split_config?.shares_paid}/{booking.split_config?.total_shares}
              </Badge>
            )}
          </View>
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
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [leavingWaitlist, setLeavingWaitlist] = useState(null);
  const [venueRecs, setVenueRecs] = useState([]);
  const [engagementScore, setEngagementScore] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  const loadData = async () => {
    try {
      const [bRes, sRes, wRes, vRecRes, engRes] = await Promise.all([
        bookingAPI.list().catch(() => ({ data: [] })),
        analyticsAPI.player().catch(() => ({ data: null })),
        waitlistAPI.myWaitlist().catch(() => ({ data: [] })),
        recommendationAPI.venues(6).catch(() => ({ data: { venues: [] } })),
        recommendationAPI.engagementScore().catch(() => ({ data: null })),
      ]);
      setBookings(bRes.data || []);
      setStats(sRes.data);
      setWaitlistEntries(wRes.data || []);
      setVenueRecs(vRecRes.data?.venues || []);
      setEngagementScore(engRes.data);
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

  const handleLeaveWaitlist = async (entryId) => {
    setLeavingWaitlist(entryId);
    try {
      await waitlistAPI.leave(entryId);
      setWaitlistEntries(prev => prev.filter(e => e.id !== entryId));
    } catch {
      Alert.alert('Error', 'Failed to leave waitlist');
    } finally {
      setLeavingWaitlist(null);
    }
  };

  const handleGetQR = async (bookingId) => {
    setQrLoading(true);
    try {
      const res = await coachingAPI.getCheckinQR(bookingId);
      setQrData(res.data);
    } catch {
      Alert.alert('Error', 'Failed to generate QR code');
    }
    setQrLoading(false);
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
          <Text style={[styles.tierBadgeText, { color: tier.color }]}>
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
          onPress={() => navigation.navigate('Venues')}
          activeOpacity={1}
        >
          <Card style={styles.searchCard} padding={false}>
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <Text style={styles.searchPlaceholder}>Search venue, area, or city...</Text>
            </View>
          </Card>
        </TouchableOpacity>

        {/* Quick Actions - matches web (4 actions) */}
        <View style={styles.actionsGrid}>
          {[
            { icon: '📍', label: 'Find Venue', desc: 'Browse available turfs', color: Colors.primaryLight, screen: 'Venues' },
            { icon: '⚔️', label: 'Find Game', desc: 'Join or create matches', color: Colors.violetLight, screen: 'Matchmaking' },
            { icon: '🏋️', label: 'Find Coach', desc: 'Book 1-on-1 sessions', color: Colors.skyLight, screen: 'CoachListing' },
            { icon: '🏆', label: 'My Profile', desc: 'Stats & match history', color: Colors.amberLight, screen: 'Profile' },
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

        {/* Engagement Score + Venue Recommendations */}
        {(engagementScore || venueRecs.length > 0) && (
          <View style={styles.section}>
            {/* Engagement Score */}
            {engagementScore && (
              <Card style={styles.engagementCard}>
                <View style={styles.engagementHeader}>
                  <Text style={{ fontSize: 16 }}>⚡</Text>
                  <Text style={styles.engagementTitle}>ENGAGEMENT</Text>
                </View>
                <View style={styles.engagementCenter}>
                  <Text style={styles.engagementScore}>{engagementScore.score}</Text>
                  <Badge variant="default" style={{ marginTop: 4 }}>{engagementScore.level}</Badge>
                </View>
                {engagementScore.breakdown && Object.keys(engagementScore.breakdown).length > 0 && (
                  <View style={{ gap: 6, marginTop: Spacing.md }}>
                    {Object.entries(engagementScore.breakdown).map(([key, val]) => (
                      <View key={key} style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>{key}</Text>
                        <View style={styles.breakdownBarBg}>
                          <View style={[styles.breakdownBarFill, { width: `${Math.min(val * 5, 100)}%` }]} />
                        </View>
                        <Text style={styles.breakdownVal}>{val}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {engagementScore.current_streak > 0 && (
                  <View style={styles.streakRow}>
                    <Text style={{ fontSize: 12 }}>🔥</Text>
                    <Text style={styles.streakText}>{engagementScore.current_streak}-day streak</Text>
                  </View>
                )}
              </Card>
            )}

            {/* Venue Recommendations */}
            {venueRecs.length > 0 && (
              <View style={{ marginTop: Spacing.md }}>
                <View style={styles.sectionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>🏟️</Text>
                    <Text style={styles.sectionTitle}>Recommended Venues</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('Venues')}>
                    <Text style={styles.viewAll}>View All →</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.sm }}>
                  {venueRecs.slice(0, 6).map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={styles.venueRecCard}
                      onPress={() => navigation.navigate('VenueDetail', { venueId: v.id, venueName: v.name })}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.venueRecName} numberOfLines={1}>{v.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Text style={{ fontSize: 10 }}>📍</Text>
                        <Text style={styles.venueRecArea} numberOfLines={1}>{v.area || v.city || ''}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        {v.average_rating > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Text style={{ fontSize: 10 }}>⭐</Text>
                            <Text style={styles.venueRecRating}>{v.average_rating?.toFixed(1)}</Text>
                          </View>
                        )}
                        {v.rec_reason && (
                          <Badge variant="secondary" style={{ paddingHorizontal: 4, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 8 }}>{v.rec_reason?.replace(/_/g, ' ')}</Text>
                          </Badge>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

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
                <BookingCard key={b.id} booking={b} onPress={() => navigation.navigate('Bookings')} onGetQR={handleGetQR} />
              ))}
            </View>
          )}
        </View>

        {/* Performance Insights */}
        {stats && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md }}>
              <Text style={{ fontSize: 14 }}>📊</Text>
              <Text style={styles.sectionTitle}>Performance Insights</Text>
            </View>
            <View style={styles.insightsGrid}>
              {[
                { label: 'TOTAL BOOKINGS', value: stats.total_bookings || 0, color: Colors.primary },
                { label: 'MATCHES PLAYED', value: stats.total_matches || user?.total_games || 0, color: Colors.primary },
                { label: 'WINS', value: user?.wins || 0, color: Colors.amber },
                { label: 'TOTAL SPENT', value: `₹${(stats.total_spent || 0).toLocaleString('en-IN')}`, color: Colors.sky },
              ].map((s, i) => (
                <View key={i} style={styles.insightBox}>
                  <Text style={[styles.insightValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.insightLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Sport Breakdown */}
            {stats.sport_breakdown && Object.keys(stats.sport_breakdown).length > 0 && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={styles.subSectionTitle}>🎯 Sports Breakdown</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm }}>
                  {Object.entries(stats.sport_breakdown).map(([sport, count]) => {
                    const total = Object.values(stats.sport_breakdown).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <View key={sport} style={styles.sportPill}>
                        <Text style={styles.sportPillText}>{sport.replace('_', ' ')}</Text>
                        <View style={styles.sportBarBg}>
                          <View style={[styles.sportBarFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.sportPillCount}>{count} ({pct}%)</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Monthly Activity */}
            {stats.monthly_bookings && stats.monthly_bookings.length > 0 && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={styles.subSectionTitle}>📈 Monthly Activity</Text>
                <View style={styles.monthlyChart}>
                  {stats.monthly_bookings.slice(-6).map((m, i) => {
                    const maxVal = Math.max(...stats.monthly_bookings.slice(-6).map(x => x.count || 0), 1);
                    const height = ((m.count || 0) / maxVal) * 100;
                    return (
                      <View key={i} style={styles.monthlyBarCol}>
                        <View style={[styles.monthlyBar, { height: `${Math.max(height, 4)}%` }]} />
                        <Text style={styles.monthlyLabel}>{m.month?.slice(-2) || ''}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* My Waitlist */}
        {waitlistEntries.length > 0 && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md }}>
              <Text style={{ fontSize: 14 }}>📋</Text>
              <Text style={styles.sectionTitle}>My Waitlist</Text>
            </View>
            <View style={{ gap: Spacing.sm }}>
              {waitlistEntries.map((entry) => (
                <Card key={entry.id} style={styles.waitlistCard}>
                  <View style={styles.waitlistRow}>
                    <View style={[styles.waitlistIcon, { backgroundColor: Colors.violetLight }]}>
                      <Text style={{ fontSize: 16 }}>📋</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.waitlistVenue}>{entry.venue_name || 'Venue'}</Text>
                      <View style={styles.waitlistMeta}>
                        <Text style={styles.waitlistMetaText}>📅 {entry.date}</Text>
                        <Text style={styles.waitlistMetaText}>  🕐 {entry.start_time}</Text>
                        <Badge variant="secondary" style={{ marginLeft: 6 }}>
                          #{entry.position || '?'} in queue
                        </Badge>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleLeaveWaitlist(entry.id)}
                      disabled={leavingWaitlist === entry.id}
                      style={styles.waitlistLeaveBtn}
                    >
                      {leavingWaitlist === entry.id ? (
                        <ActivityIndicator size="small" color={Colors.mutedForeground} />
                      ) : (
                        <Text style={{ color: Colors.destructive, fontSize: 14, fontFamily: Typography.fontBodyBold }}>✕</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Recent Games */}
        {past.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Games</Text>
            <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
              {past.slice(0, 3).map(b => (
                <BookingCard key={b.id} booking={b} onPress={() => navigation.navigate('Bookings')} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* QR Code Modal */}
      <Modal visible={!!qrData} transparent animationType="fade" onRequestClose={() => setQrData(null)}>
        <View style={styles.qrOverlay}>
          <TouchableOpacity style={styles.qrBackdrop} activeOpacity={1} onPress={() => setQrData(null)} />
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Check-in QR Code</Text>
            {qrData && (
              <>
                <View style={styles.qrCodeBox}>
                  <Text style={styles.qrCodeText}>{qrData.qr_data}</Text>
                </View>
                <Text style={styles.qrHint}>
                  Show this to venue staff to check in at{' '}
                  <Text style={{ fontFamily: Typography.fontBodyBold, color: Colors.foreground }}>{qrData.venue_name}</Text>
                </Text>
                <Text style={styles.qrMeta}>{qrData.date} · {qrData.start_time}</Text>
                {qrData.expires_at && (
                  <Text style={styles.qrExpiry}>Expires: {new Date(qrData.expires_at).toLocaleString()}</Text>
                )}
              </>
            )}
            <Button variant="secondary" onPress={() => setQrData(null)} style={{ marginTop: Spacing.md }}>
              Close
            </Button>
          </View>
        </View>
      </Modal>
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
  tierBadgeText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, marginTop: 4 },
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
  subSectionTitle: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5 },
  viewAll: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xl2 },
  emptyIcon: { fontSize: 32, marginBottom: Spacing.md },
  emptyText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },

  // Booking card
  bookingCard: { padding: Spacing.md },
  bookingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bookingVenue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, flex: 1 },
  bookingMeta: { flexDirection: 'row', flexWrap: 'wrap' },
  bookingMetaText: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  bookingAmount: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  qrBtn: { backgroundColor: Colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Spacing.radiusSm, marginTop: 2 },
  qrBtnText: { fontSize: 10, fontFamily: Typography.fontBodyBold, color: Colors.foreground },

  // Engagement
  engagementCard: { padding: Spacing.md },
  engagementHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  engagementTitle: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5 },
  engagementCenter: { alignItems: 'center', marginBottom: Spacing.sm },
  engagementScore: { fontSize: Typography.xl5, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakdownLabel: { fontSize: 10, fontFamily: Typography.fontBody, color: Colors.mutedForeground, width: 70, textTransform: 'capitalize' },
  breakdownBarBg: { flex: 1, height: 5, backgroundColor: Colors.secondary, borderRadius: 3, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3, opacity: 0.6 },
  breakdownVal: { fontSize: 10, fontFamily: Typography.fontBodyBold, color: Colors.foreground, width: 20, textAlign: 'right' },
  streakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: Spacing.sm },
  streakText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.amber },

  // Venue Recommendations
  venueRecCard: { width: 160, padding: Spacing.md, backgroundColor: Colors.card, borderRadius: Spacing.radiusLg, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm },
  venueRecName: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  venueRecArea: { fontSize: 10, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  venueRecRating: { fontSize: 10, fontFamily: Typography.fontBodyBold, color: Colors.amber },

  // Performance Insights
  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  insightBox: { width: '47.5%', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.secondary, borderRadius: Spacing.radiusLg },
  insightValue: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack },
  insightLabel: { fontSize: 9, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

  // Sport breakdown
  sportPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, borderRadius: Spacing.radiusFull, paddingHorizontal: Spacing.md, paddingVertical: 6, gap: 6 },
  sportPillText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.foreground, textTransform: 'capitalize' },
  sportBarBg: { width: 50, height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  sportBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  sportPillCount: { fontSize: 9, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },

  // Monthly chart
  monthlyChart: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4, marginTop: Spacing.sm },
  monthlyBarCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  monthlyBar: { width: '80%', backgroundColor: Colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: 0.8 },
  monthlyLabel: { fontSize: 8, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground, marginTop: 4 },

  // Waitlist
  waitlistCard: { padding: Spacing.md },
  waitlistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  waitlistIcon: { width: 40, height: 40, borderRadius: Spacing.radiusLg, justifyContent: 'center', alignItems: 'center' },
  waitlistVenue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  waitlistMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  waitlistMetaText: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  waitlistLeaveBtn: { padding: Spacing.sm },

  // QR Modal
  qrOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  qrCard: { backgroundColor: Colors.card, borderRadius: 20, padding: Spacing.xl2, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  qrTitle: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.lg },
  qrCodeBox: { backgroundColor: '#fff', padding: Spacing.xl, borderRadius: Spacing.radiusLg, marginBottom: Spacing.md },
  qrCodeText: { fontFamily: Typography.fontBody, fontSize: 10, color: '#333', textAlign: 'center' },
  qrHint: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textAlign: 'center', marginTop: Spacing.sm },
  qrMeta: { fontSize: 10, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
  qrExpiry: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4, opacity: 0.6 },
});
