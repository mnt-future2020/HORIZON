import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { bookingAPI } from '../api';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

const TABS = ['upcoming', 'past', 'cancelled'];

function BookingCard({ booking, onCancel }) {
  const isPast = new Date(booking.date) < new Date(new Date().toDateString());
  const badgeVariant =
    booking.status === 'confirmed' ? 'default' :
    booking.status === 'pending' ? 'amber' : 'destructive';

  const canCancel = booking.status !== 'cancelled' && !isPast;

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.venueName} numberOfLines={1}>{booking.venue_name || 'Venue'}</Text>
        <Badge variant={badgeVariant}>{booking.status}</Badge>
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>📅</Text>
          <Text style={styles.metaText}>{booking.date}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>🕐</Text>
          <Text style={styles.metaText}>{booking.start_time} – {booking.end_time}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>🏅</Text>
          <Text style={styles.metaText}>{booking.sport || 'Sport'}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.amount}>₹{(booking.total_amount || 0).toLocaleString('en-IN')}</Text>
          {booking.payment_mode === 'split' && (
            <Text style={styles.splitText}>
              Split {booking.split_config?.shares_paid}/{booking.split_config?.total_shares}
            </Text>
          )}
        </View>
        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onPress={() => onCancel(booking.id)}
          >
            Cancel
          </Button>
        )}
      </View>
    </Card>
  );
}

export default function BookingsScreen() {
  const navigation = useNavigation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');

  const loadBookings = async () => {
    try {
      const res = await bookingAPI.list();
      setBookings(res.data || []);
    } catch (err) {
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadBookings(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const handleCancel = (id) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking', style: 'destructive',
          onPress: async () => {
            try {
              await bookingAPI.cancel(id);
              loadBookings();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.detail || 'Failed to cancel booking');
            }
          }
        },
      ]
    );
  };

  const today = new Date(new Date().toDateString());
  const filtered = bookings.filter(b => {
    const bDate = new Date(b.date);
    if (activeTab === 'upcoming') return b.status !== 'cancelled' && bDate >= today;
    if (activeTab === 'past') return bDate < today;
    if (activeTab === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>MY</Text>
        <Text style={styles.headerTitle}>Bookings</Text>
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
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>📅</Text>
              <Text style={styles.emptyText}>
                No {activeTab} bookings
              </Text>
              {activeTab === 'upcoming' && (
                <Button
                  onPress={() => navigation.navigate('Venues')}
                  style={{ marginTop: Spacing.md }}
                >
                  Book a Venue
                </Button>
              )}
            </View>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {filtered.map(b => (
                <BookingCard key={b.id} booking={b} onCancel={handleCancel} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: Typography.widest },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },
  tabBar: { flexDirection: 'row', marginHorizontal: Spacing.base, backgroundColor: Colors.secondary, borderRadius: Spacing.radiusMd, padding: 3, marginBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Spacing.radiusSm },
  tabActive: { backgroundColor: Colors.card },
  tabText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  tabTextActive: { color: Colors.foreground },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  card: { padding: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  venueName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, flex: 1, marginRight: Spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 12 },
  metaText: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  amount: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  splitText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.primary },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, textAlign: 'center' },
});
