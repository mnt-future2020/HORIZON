import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { venueAPI, analyticsAPI, bookingAPI } from '../../api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import TabBar from '../../components/common/TabBar';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'reviews', label: 'Reviews' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

function BookingRow({ booking }) {
  const badgeVariant =
    booking.status === 'confirmed' ? 'default' :
    booking.status === 'pending' ? 'amber' : 'destructive';

  return (
    <Card style={styles.bookingRow}>
      <View style={styles.bookingHeader}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <Text style={styles.bookingVenue} numberOfLines={1}>
            {booking.venue_name || 'Venue'}
          </Text>
          <View style={styles.bookingMeta}>
            <Text style={styles.bookingMetaText}>
              {booking.date} | {booking.start_time}-{booking.end_time}
            </Text>
          </View>
          {booking.sport && (
            <Text style={styles.bookingSport}>{booking.sport}</Text>
          )}
          {booking.customer_name && (
            <Text style={styles.bookingCustomer}>{booking.customer_name}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Badge variant={badgeVariant}>{booking.status}</Badge>
          <Text style={styles.bookingAmount}>
            {'\u20B9'}{(booking.total_amount || 0).toLocaleString('en-IN')}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function PricingRuleCard({ rule, onToggle, onDelete }) {
  const dayLabel = rule.days_of_week
    ? rule.days_of_week.map(d => DAYS[d] ? DAYS[d].slice(0, 3) : d).join(', ')
    : 'All days';

  return (
    <Card style={styles.pricingCard}>
      <View style={styles.pricingHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pricingType}>
            {rule.rule_type === 'multiplier' ? 'Multiplier' : 'Fixed'}: {rule.value}
            {rule.rule_type === 'multiplier' ? 'x' : ''}
          </Text>
          <Text style={styles.pricingDays}>{dayLabel}</Text>
          <Text style={styles.pricingTime}>
            {rule.start_time || '00:00'} - {rule.end_time || '23:59'}
          </Text>
          {rule.priority != null && (
            <Text style={styles.pricingPriority}>Priority: {rule.priority}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: Spacing.sm }}>
          <Switch
            value={rule.is_active !== false}
            onValueChange={() => onToggle(rule.id)}
            trackColor={{ false: Colors.secondary, true: Colors.primaryLight }}
            thumbColor={rule.is_active !== false ? Colors.primary : Colors.mutedForeground}
          />
          <TouchableOpacity onPress={() => onDelete(rule.id)}>
            <Text style={{ color: Colors.destructive, fontSize: Typography.xs, fontFamily: Typography.fontBodyBold }}>DELETE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

function ReviewCard({ review }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < (review.rating || 0) ? '\u2605' : '\u2606').join('');
  return (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewUser}>{review.user_name || 'Anonymous'}</Text>
        <Text style={styles.reviewDate}>
          {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
        </Text>
      </View>
      <Text style={styles.reviewStars}>{stars}</Text>
      {review.comment ? (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      ) : null}
    </Card>
  );
}

export default function VenueOwnerDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [reviews, setReviews] = useState([]);

  // Pricing rule modal
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    days_of_week: [],
    start_time: '',
    end_time: '',
    rule_type: 'multiplier',
    value: '',
    priority: '0',
  });
  const [ruleSaving, setRuleSaving] = useState(false);

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  const loadVenues = async () => {
    try {
      const res = await venueAPI.getOwnerVenues();
      const v = res.data || [];
      setVenues(v);
      if (v.length > 0 && !selectedVenueId) {
        setSelectedVenueId(v[0].id);
      }
    } catch {
      setVenues([]);
    }
  };

  const loadVenueData = useCallback(async () => {
    if (!selectedVenueId) return;
    try {
      const [aRes, bRes, pRes, rRes] = await Promise.all([
        analyticsAPI.venue(selectedVenueId).catch(() => ({ data: null })),
        bookingAPI.list().catch(() => ({ data: [] })),
        venueAPI.getPricingRules(selectedVenueId).catch(() => ({ data: [] })),
        venueAPI.getReviews(selectedVenueId).catch(() => ({ data: [] })),
      ]);
      setAnalytics(aRes.data);
      setBookings(bRes.data || []);
      setPricingRules(pRes.data || []);
      setReviews(rRes.data || []);
    } catch {
      // silently fail
    }
  }, [selectedVenueId]);

  const loadData = async () => {
    try {
      await loadVenues();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedVenueId) {
      loadVenueData();
    }
  }, [selectedVenueId, loadVenueData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData().then(() => loadVenueData());
  };

  // Pricing rule actions
  const handleToggleRule = async (ruleId) => {
    try {
      await venueAPI.togglePricingRule(ruleId);
      const updated = pricingRules.map(r =>
        r.id === ruleId ? { ...r, is_active: !r.is_active } : r
      );
      setPricingRules(updated);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to toggle rule');
    }
  };

  const handleDeleteRule = (ruleId) => {
    Alert.alert('Delete Rule', 'Are you sure you want to delete this pricing rule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await venueAPI.deletePricingRule(ruleId);
            setPricingRules(prev => prev.filter(r => r.id !== ruleId));
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete rule');
          }
        },
      },
    ]);
  };

  const handleAddRule = async () => {
    if (!ruleForm.start_time || !ruleForm.end_time || !ruleForm.value) {
      Alert.alert('Validation', 'Please fill in start time, end time, and value.');
      return;
    }
    setRuleSaving(true);
    try {
      const payload = {
        days_of_week: ruleForm.days_of_week.length > 0 ? ruleForm.days_of_week : [0, 1, 2, 3, 4, 5, 6],
        start_time: ruleForm.start_time,
        end_time: ruleForm.end_time,
        rule_type: ruleForm.rule_type,
        value: parseFloat(ruleForm.value) || 1,
        priority: parseInt(ruleForm.priority, 10) || 0,
      };
      await venueAPI.createPricingRule(selectedVenueId, payload);
      setRuleModalVisible(false);
      setRuleForm({ days_of_week: [], start_time: '', end_time: '', rule_type: 'multiplier', value: '', priority: '0' });
      const res = await venueAPI.getPricingRules(selectedVenueId);
      setPricingRules(res.data || []);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to create rule');
    } finally {
      setRuleSaving(false);
    }
  };

  const toggleDay = (idx) => {
    setRuleForm(prev => {
      const days = prev.days_of_week.includes(idx)
        ? prev.days_of_week.filter(d => d !== idx)
        : [...prev.days_of_week, idx];
      return { ...prev, days_of_week: days };
    });
  };

  // Pending approval check
  if (user?.account_status === 'pending') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.pendingContainer}>
          <Card style={styles.pendingCard}>
            <Text style={styles.pendingIcon}>{'\u23F3'}</Text>
            <Text style={styles.pendingTitle}>Account Pending Approval</Text>
            <Text style={styles.pendingText}>
              Your venue owner account is currently under review. You will be notified once an admin approves your account. This usually takes 24-48 hours.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Filter bookings by selected venue
  const venueBookings = bookings.filter(
    b => !selectedVenueId || b.venue_id === selectedVenueId
  );

  const recentBookings = venueBookings.slice(0, 5);
  const totalRevenue = analytics?.total_revenue || venueBookings.reduce((s, b) => s + (b.total_amount || 0), 0);
  const totalBookings = analytics?.total_bookings || venueBookings.length;
  const avgRating = analytics?.avg_rating || (reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : '0');

  const renderOverview = () => (
    <View>
      <View style={styles.statsGrid}>
        <StatCard label="TOTAL REVENUE" value={`\u20B9${Number(totalRevenue).toLocaleString('en-IN')}`} textIcon={'\uD83D\uDCB0'} bg={Colors.primaryLight} valueColor={Colors.primary} />
        <StatCard label="TOTAL BOOKINGS" value={totalBookings} textIcon={'\uD83D\uDCCB'} bg={Colors.violetLight} valueColor={Colors.violet} />
        <StatCard label="ACTIVE VENUES" value={venues.length} textIcon={'\uD83C\uDFDF\uFE0F'} bg={Colors.skyLight} valueColor={Colors.sky} />
        <StatCard label="AVG RATING" value={avgRating} textIcon={'\u2B50'} bg={Colors.amberLight} valueColor={Colors.amber} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Bookings</Text>
        {recentBookings.length === 0 ? (
          <EmptyState icon={'\uD83D\uDCCB'} title="No bookings yet" subtitle="Bookings will appear here once customers start booking." />
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {recentBookings.map((b, i) => (
              <BookingRow key={b.id || i} booking={b} />
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderBookings = () => (
    <View>
      {venueBookings.length === 0 ? (
        <EmptyState icon={'\uD83D\uDCCB'} title="No bookings" subtitle="No bookings found for this venue." />
      ) : (
        <FlatList
          data={venueBookings}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={({ item }) => <BookingRow booking={item} />}
          contentContainerStyle={{ gap: Spacing.sm }}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderPricing = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pricing Rules</Text>
        <Button size="sm" onPress={() => setRuleModalVisible(true)}>Add Rule</Button>
      </View>
      {pricingRules.length === 0 ? (
        <EmptyState icon={'\uD83D\uDCB2'} title="No pricing rules" subtitle="Add custom pricing rules for peak hours, weekends, etc." actionLabel="Add Rule" onAction={() => setRuleModalVisible(true)} />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {pricingRules.map((rule, i) => (
            <PricingRuleCard
              key={rule.id || i}
              rule={rule}
              onToggle={handleToggleRule}
              onDelete={handleDeleteRule}
            />
          ))}
        </View>
      )}
    </View>
  );

  const renderReviews = () => (
    <View>
      <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
      {reviews.length === 0 ? (
        <EmptyState icon={'\u2B50'} title="No reviews yet" subtitle="Reviews from players will appear here." />
      ) : (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {reviews.map((r, i) => (
            <ReviewCard key={r.id || i} review={r} />
          ))}
        </View>
      )}
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
          <Text style={styles.headerSub}>VENUE OWNER</Text>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>

        {/* Venue Selector */}
        {venues.length > 1 && (
          <TouchableOpacity
            style={styles.venuePicker}
            onPress={() => setVenuePickerOpen(true)}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.venuePickerLabel}>SELECTED VENUE</Text>
              <Text style={styles.venuePickerValue} numberOfLines={1}>
                {selectedVenue?.name || 'Select venue'}
              </Text>
            </View>
            <Text style={styles.venuePickerArrow}>{'\u25BC'}</Text>
          </TouchableOpacity>
        )}

        {venues.length === 1 && (
          <Card style={styles.singleVenueBanner}>
            <Text style={styles.singleVenueName}>{venues[0]?.name}</Text>
            <Text style={styles.singleVenueCity}>{venues[0]?.city || venues[0]?.area || ''}</Text>
          </Card>
        )}

        {/* Tabs */}
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'bookings' && renderBookings()}
          {activeTab === 'pricing' && renderPricing()}
          {activeTab === 'reviews' && renderReviews()}
        </View>
      </ScrollView>

      {/* Venue Picker Modal */}
      <ModalSheet visible={venuePickerOpen} onClose={() => setVenuePickerOpen(false)} title="Select Venue">
        {venues.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.venueOption, selectedVenueId === v.id && styles.venueOptionActive]}
            onPress={() => {
              setSelectedVenueId(v.id);
              setVenuePickerOpen(false);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.venueOptionName}>{v.name}</Text>
              <Text style={styles.venueOptionCity}>{v.city || v.area || ''}</Text>
            </View>
            {selectedVenueId === v.id && (
              <Text style={{ color: Colors.primary, fontSize: 18 }}>{'\u2713'}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ModalSheet>

      {/* Add Pricing Rule Modal */}
      <ModalSheet visible={ruleModalVisible} onClose={() => setRuleModalVisible(false)} title="Add Pricing Rule">
        <Text style={styles.formLabel}>Days of Week</Text>
        <View style={styles.daysGrid}>
          {DAYS.map((day, idx) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayChip,
                ruleForm.days_of_week.includes(idx) && styles.dayChipActive,
              ]}
              onPress={() => toggleDay(idx)}
            >
              <Text
                style={[
                  styles.dayChipText,
                  ruleForm.days_of_week.includes(idx) && styles.dayChipTextActive,
                ]}
              >
                {day.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Start Time (HH:MM)"
          value={ruleForm.start_time}
          onChangeText={(v) => setRuleForm(prev => ({ ...prev, start_time: v }))}
          placeholder="e.g. 06:00"
        />
        <Input
          label="End Time (HH:MM)"
          value={ruleForm.end_time}
          onChangeText={(v) => setRuleForm(prev => ({ ...prev, end_time: v }))}
          placeholder="e.g. 22:00"
        />

        <Text style={styles.formLabel}>Rule Type</Text>
        <View style={styles.ruleTypeRow}>
          <TouchableOpacity
            style={[styles.ruleTypeBtn, ruleForm.rule_type === 'multiplier' && styles.ruleTypeBtnActive]}
            onPress={() => setRuleForm(prev => ({ ...prev, rule_type: 'multiplier' }))}
          >
            <Text style={[styles.ruleTypeBtnText, ruleForm.rule_type === 'multiplier' && styles.ruleTypeBtnTextActive]}>Multiplier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ruleTypeBtn, ruleForm.rule_type === 'fixed' && styles.ruleTypeBtnActive]}
            onPress={() => setRuleForm(prev => ({ ...prev, rule_type: 'fixed' }))}
          >
            <Text style={[styles.ruleTypeBtnText, ruleForm.rule_type === 'fixed' && styles.ruleTypeBtnTextActive]}>Fixed Amount</Text>
          </TouchableOpacity>
        </View>

        <Input
          label={ruleForm.rule_type === 'multiplier' ? 'Multiplier Value (e.g. 1.5)' : 'Fixed Amount (INR)'}
          value={ruleForm.value}
          onChangeText={(v) => setRuleForm(prev => ({ ...prev, value: v }))}
          placeholder={ruleForm.rule_type === 'multiplier' ? '1.5' : '500'}
          keyboardType="numeric"
        />
        <Input
          label="Priority (higher = more important)"
          value={ruleForm.priority}
          onChangeText={(v) => setRuleForm(prev => ({ ...prev, priority: v }))}
          placeholder="0"
          keyboardType="numeric"
        />

        <Button onPress={handleAddRule} loading={ruleSaving} style={{ marginTop: Spacing.md }}>
          Create Rule
        </Button>
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl * 3 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  // Pending
  pendingContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.base },
  pendingCard: { alignItems: 'center', paddingVertical: Spacing.xl2 },
  pendingIcon: { fontSize: 48, marginBottom: Spacing.md },
  pendingTitle: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.sm, textAlign: 'center' },
  pendingText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textAlign: 'center', lineHeight: 20 },

  // Header
  header: { marginTop: Spacing.base, marginBottom: Spacing.lg },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 2 },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4 },

  // Venue picker
  venuePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Spacing.radiusLg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.md },
  venuePickerLabel: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.5 },
  venuePickerValue: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginTop: 2 },
  venuePickerArrow: { fontSize: 12, color: Colors.mutedForeground, marginLeft: Spacing.sm },

  singleVenueBanner: { padding: Spacing.md, marginBottom: Spacing.md },
  singleVenueName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  singleVenueCity: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },

  // Venue picker modal
  venueOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  venueOptionActive: { backgroundColor: Colors.primaryLight, marginHorizontal: -Spacing.xl, paddingHorizontal: Spacing.xl, borderRadius: Spacing.radiusMd },
  venueOptionName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  venueOptionCity: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },

  // Tab content
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

  // Booking row
  bookingRow: { padding: Spacing.md },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  bookingVenue: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  bookingMeta: { flexDirection: 'row', marginTop: 4 },
  bookingMetaText: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  bookingSport: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.primary, marginTop: 2 },
  bookingCustomer: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  bookingAmount: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: Spacing.xs },

  // Pricing
  pricingCard: { padding: Spacing.md },
  pricingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pricingType: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  pricingDays: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
  pricingTime: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.sky, marginTop: 2 },
  pricingPriority: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.amber, marginTop: 2 },

  // Reviews
  reviewCard: { padding: Spacing.md },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  reviewUser: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  reviewDate: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  reviewStars: { fontSize: Typography.lg, color: Colors.amber, marginBottom: Spacing.xs },
  reviewComment: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, lineHeight: 20 },

  // Form
  formLabel: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  dayChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusFull, backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border },
  dayChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  dayChipText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  dayChipTextActive: { color: Colors.primary },
  ruleTypeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  ruleTypeBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusMd, backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  ruleTypeBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  ruleTypeBtnText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  ruleTypeBtnTextActive: { color: Colors.primary },
});
