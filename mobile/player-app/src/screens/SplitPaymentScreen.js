import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { splitAPI } from '../api';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

// Progress bar component
function ProgressBar({ value, max, color = Colors.primary }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

function ShareCard({ booking }) {
  const [creating, setCreating] = useState(false);
  const [splitData, setSplitData] = useState(null);

  const createSplit = async () => {
    setCreating(true);
    try {
      const res = await splitAPI.createLink(booking.id);
      setSplitData(res.data);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create split link');
    } finally {
      setCreating(false);
    }
  };

  const handleShare = async () => {
    const url = splitData?.split_url;
    if (!url) return;
    await Share.share({ message: `Pay your share for our booking at ${booking.venue_name}! ${url}`, url });
  };

  const paidCount = splitData?.paid_shares || 0;
  const totalShares = splitData?.total_shares || 2;
  const amountPerShare = booking.total_amount / totalShares;

  return (
    <Card style={styles.shareCard}>
      <View style={styles.bookingInfo}>
        <Text style={styles.venueName}>{booking.venue_name}</Text>
        <Text style={styles.bookingDate}>📅 {booking.date} • 🕐 {booking.start_time}–{booking.end_time}</Text>
      </View>
      <View style={styles.amountRow}>
        <Text style={styles.totalAmount}>₹{(booking.total_amount || 0).toLocaleString('en-IN')}</Text>
        <Text style={styles.perShare}>₹{amountPerShare.toLocaleString('en-IN')} / person</Text>
      </View>

      {!splitData ? (
        <Button onPress={createSplit} loading={creating} style={{ marginTop: Spacing.md }}>
          💰 Create Split Link
        </Button>
      ) : (
        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.splitStatusText}>{paidCount}/{totalShares} paid</Text>
            <Text style={[styles.splitStatusText, { color: Colors.primary }]}>
              ₹{(paidCount * amountPerShare).toLocaleString('en-IN')} collected
            </Text>
          </View>
          <ProgressBar value={paidCount} max={totalShares} />
          <Button onPress={handleShare} variant="secondary">🔗 Share Payment Link</Button>
        </View>
      )}
    </Card>
  );
}

// Public split payment page (accessed via share link)
function SplitPayPage({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payerName, setPayerName] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    splitAPI.getInfo(token)
      .then(res => setData(res.data))
      .catch(() => Alert.alert('Error', 'Invalid or expired split link'))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async () => {
    if (!payerName.trim()) { Alert.alert('Enter your name first'); return; }
    setPaying(true);
    try {
      await splitAPI.pay(token, { payer_name: payerName });
      setPaid(true);
      const res = await splitAPI.getInfo(token);
      setData(res.data);
      Alert.alert('Payment Successful! 🎉', 'Your share has been paid.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!data) return (
    <View style={styles.errorContainer}>
      <Text style={{ fontSize: 48 }}>❌</Text>
      <Text style={styles.errorText}>Invalid or expired split link</Text>
    </View>
  );

  const paidCount = data.paid_shares || 0;
  const totalShares = data.total_shares || 2;
  const amountPerShare = (data.total_amount || 0) / totalShares;
  const pct = Math.round((paidCount / totalShares) * 100);

  return (
    <ScrollView contentContainerStyle={styles.splitPayContent} showsVerticalScrollIndicator={false}>
      <View style={styles.splitPayHeader}>
        <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>💰</Text>
        <Text style={styles.splitPayTitle}>Split Payment</Text>
        <Text style={styles.splitPaySubtitle}>{data.venue_name}</Text>
      </View>

      {/* Booking details */}
      <Card style={styles.detailsCard}>
        {[
          { icon: '📅', label: 'Date', value: data.date },
          { icon: '🕐', label: 'Time', value: `${data.start_time} – ${data.end_time}` },
          { icon: '📍', label: 'Venue', value: data.venue_name },
          { icon: '👥', label: 'Players', value: `${totalShares}` },
        ].map((item, i) => (
          <View key={i} style={[styles.detailRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
            <Text style={styles.detailLabel}>{item.icon} {item.label}</Text>
            <Text style={styles.detailValue}>{item.value}</Text>
          </View>
        ))}
      </Card>

      {/* Payment amount */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Your Share</Text>
        <Text style={styles.amountValue}>₹{amountPerShare.toLocaleString('en-IN')}</Text>
        <Text style={styles.amountTotal}>of ₹{(data.total_amount || 0).toLocaleString('en-IN')} total</Text>
      </View>

      {/* Progress */}
      <Card style={styles.progressCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
          <Text style={styles.progressLabel}>Collection Progress</Text>
          <Text style={[styles.progressLabel, { color: Colors.primary }]}>{pct}%</Text>
        </View>
        <ProgressBar value={paidCount} max={totalShares} />
        <Text style={[styles.progressSub, { marginTop: Spacing.sm }]}>
          {paidCount} of {totalShares} shares paid • ₹{(paidCount * amountPerShare).toLocaleString('en-IN')} collected
        </Text>
      </Card>

      {/* Pay form */}
      {!paid ? (
        <Card>
          <Input
            label="Your Name"
            value={payerName}
            onChangeText={setPayerName}
            placeholder="Enter your name to pay"
            autoCapitalize="words"
          />
          <Button onPress={handlePay} loading={paying}>
            Pay ₹{amountPerShare.toLocaleString('en-IN')}
          </Button>
        </Card>
      ) : (
        <Card style={styles.paidCard}>
          <Text style={{ fontSize: 40, marginBottom: Spacing.sm }}>✅</Text>
          <Text style={styles.paidTitle}>Payment Complete!</Text>
          <Text style={styles.paidSubText}>Thank you, {payerName}!</Text>
        </Card>
      )}
    </ScrollView>
  );
}

export default function SplitPaymentScreen() {
  const route = useRoute();
  const { token, bookings } = route.params || {};

  // If accessed via share token, show split pay page
  if (token) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SplitPayPage token={token} />
      </SafeAreaView>
    );
  }

  // Otherwise show split links for bookings
  const confirmedBookings = (bookings || []).filter(b => b.status === 'confirmed');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerSub}>SPLIT THE BILL</Text>
        <Text style={styles.headerTitle}>Split Payment</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {confirmedBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 48 }}>💰</Text>
            <Text style={styles.emptyText}>No confirmed bookings</Text>
            <Text style={styles.emptySubText}>Book a venue first to split the cost with friends</Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            {confirmedBookings.map(b => <ShareCard key={b.id} booking={b} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: Typography.widest },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  emptySubText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textAlign: 'center' },
  shareCard: { padding: Spacing.md },
  bookingInfo: { marginBottom: Spacing.sm },
  venueName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  bookingDate: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalAmount: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  perShare: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  splitStatusText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  progressBg: { height: 6, backgroundColor: Colors.secondary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  errorText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  splitPayContent: { padding: Spacing.base, paddingBottom: Spacing.xl3 },
  splitPayHeader: { alignItems: 'center', paddingVertical: Spacing.xl },
  splitPayTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  splitPaySubtitle: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.primary, marginTop: Spacing.xs },
  detailsCard: { padding: 0, marginBottom: Spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  detailLabel: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  detailValue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  amountCard: { backgroundColor: Colors.primaryLight, borderRadius: Spacing.radiusLg, borderWidth: 1, borderColor: Colors.primary, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md },
  amountLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 2, marginBottom: Spacing.sm },
  amountValue: { fontSize: Typography.xl5, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  amountTotal: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
  progressCard: { marginBottom: Spacing.md },
  progressLabel: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  progressSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  paidCard: { alignItems: 'center', paddingVertical: Spacing.xl2 },
  paidTitle: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  paidSubText: { fontSize: Typography.base, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 6 },
});
