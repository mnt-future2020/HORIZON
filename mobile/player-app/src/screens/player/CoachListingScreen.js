import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { coachingAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SearchBar from '../../components/common/SearchBar';
import FilterChips from '../../components/common/FilterChips';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import TabBar from '../../components/common/TabBar';
import ModalSheet from '../../components/common/ModalSheet';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const TABS = [
  { key: 'find', label: 'Find Coach' },
  { key: 'sessions', label: 'My Sessions' },
];

const SPORT_FILTERS = [
  { key: 'All', label: 'All' },
  { key: 'Football', label: 'Football' },
  { key: 'Cricket', label: 'Cricket' },
  { key: 'Basketball', label: 'Basketball' },
  { key: 'Badminton', label: 'Badminton' },
  { key: 'Tennis', label: 'Tennis' },
];

function StarRating({ rating, size = 14 }) {
  const stars = [];
  const full = Math.floor(rating || 0);
  const half = (rating || 0) - full >= 0.5;
  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Text key={i} style={{ fontSize: size, color: Colors.amber }}>{'★'}</Text>);
    } else if (i === full && half) {
      stars.push(<Text key={i} style={{ fontSize: size, color: Colors.amber }}>{'★'}</Text>);
    } else {
      stars.push(<Text key={i} style={{ fontSize: size, color: Colors.secondary }}>{'★'}</Text>);
    }
  }
  return <View style={{ flexDirection: 'row', gap: 1 }}>{stars}</View>;
}

function CoachCard({ coach, onBook }) {
  return (
    <Card style={styles.coachCard}>
      <View style={styles.coachHeader}>
        <Avatar uri={coach.avatar} name={coach.name || ''} size={52} />
        <View style={styles.coachInfo}>
          <Text style={styles.coachName}>{coach.name}</Text>
          <View style={styles.coachSports}>
            {(coach.sports || []).slice(0, 3).map((s) => (
              <Badge key={s} variant="secondary" style={{ marginRight: 4, marginBottom: 2 }}>{s}</Badge>
            ))}
          </View>
          <View style={styles.ratingRow}>
            <StarRating rating={coach.rating} />
            {coach.rating != null && (
              <Text style={styles.ratingNum}>{coach.rating.toFixed(1)}</Text>
            )}
          </View>
        </View>
        <View style={styles.coachPrice}>
          <Text style={styles.priceAmount}>{'\u20B9'}{coach.price_per_session || 0}</Text>
          <Text style={styles.priceUnit}>/session</Text>
        </View>
      </View>

      <View style={styles.coachMeta}>
        {coach.city && <Text style={styles.metaItem}>{coach.city}</Text>}
        {coach.total_sessions != null && (
          <Text style={styles.metaItem}>{coach.total_sessions} sessions</Text>
        )}
      </View>

      <View style={styles.coachFooter}>
        <View />
        <Button size="sm" onPress={() => onBook(coach)}>Book</Button>
      </View>
    </Card>
  );
}

function SessionCard({ session, onCancel, onReview }) {
  const isPast = session.status === 'completed' || session.status === 'cancelled';
  const isUpcoming = session.status === 'confirmed' || session.status === 'pending';

  return (
    <Card style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Avatar uri={session.coach_avatar} name={session.coach_name || ''} size={40} />
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionCoach}>{session.coach_name || 'Coach'}</Text>
          <Text style={styles.sessionSport}>{session.sport}</Text>
        </View>
        <Badge
          variant={
            session.status === 'confirmed' ? 'default'
              : session.status === 'pending' ? 'amber'
                : session.status === 'completed' ? 'secondary'
                  : 'destructive'
          }
        >
          {session.status}
        </Badge>
      </View>

      <View style={styles.sessionMeta}>
        <Text style={styles.metaItem}>{session.date} at {session.slot || session.time || '--'}</Text>
        {session.notes && <Text style={styles.metaItem}>{session.notes}</Text>}
      </View>

      <View style={styles.sessionFooter}>
        <Text style={[styles.priceAmount, { fontSize: Typography.sm }]}>
          {'\u20B9'}{session.price || session.amount || 0}
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {isUpcoming && (
            <Button size="sm" variant="destructive" onPress={() => onCancel(session.id)}>Cancel</Button>
          )}
          {session.status === 'completed' && !session.reviewed && (
            <Button size="sm" variant="secondary" onPress={() => onReview(session)}>Review</Button>
          )}
          {session.reviewed && <Badge variant="default">Reviewed</Badge>}
        </View>
      </View>
    </Card>
  );
}

export default function CoachListingScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('find');
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState('All');
  const [coaches, setCoaches] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Booking modal state
  const [bookVisible, setBookVisible] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [bookDate, setBookDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookSport, setBookSport] = useState('');
  const [bookNotes, setBookNotes] = useState('');
  const [bookLoading, setBookLoading] = useState(false);

  // Packages & subscriptions
  const [coachPackages, setCoachPackages] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [subscribing, setSubscribing] = useState(false);

  // Review modal state
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewSession, setReviewSessionData] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const loadCoaches = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedSport !== 'All') params.sport = selectedSport;
      const res = await coachingAPI.listCoaches(params).catch(() => ({ data: [] }));
      setCoaches(res.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedSport]);

  const loadMySubscriptions = useCallback(async () => {
    try {
      const res = await coachingAPI.mySubscriptions();
      setMySubscriptions(res.data || []);
    } catch { setMySubscriptions([]); }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await coachingAPI.listSessions().catch(() => ({ data: [] }));
      setSessions(res.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'find') {
      loadCoaches();
    } else {
      loadSessions();
    }
    loadMySubscriptions();
  }, [activeTab, selectedSport]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'find') {
      loadCoaches();
    } else {
      loadSessions();
    }
  };

  const handleSearch = () => {
    setLoading(true);
    loadCoaches();
  };

  // -- Booking Flow --
  const openBookModal = (coach) => {
    setSelectedCoach(coach);
    setBookDate('');
    setAvailableSlots([]);
    setSelectedSlot('');
    setBookSport(coach.sports?.[0] || '');
    setBookNotes('');
    setBookVisible(true);
    coachingAPI.getCoachPackages(coach.id).then(r => setCoachPackages(r.data || [])).catch(() => setCoachPackages([]));
  };

  const loadSlots = async () => {
    if (!bookDate) {
      Alert.alert('Error', 'Please enter a date first');
      return;
    }
    setSlotsLoading(true);
    try {
      const res = await coachingAPI.getCoachSlots(selectedCoach.id, bookDate);
      setAvailableSlots(res.data || []);
      setSelectedSlot('');
    } catch (err) {
      Alert.alert('Error', 'Failed to load available slots');
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot) {
      Alert.alert('Error', 'Please select a time slot');
      return;
    }
    if (!bookSport) {
      Alert.alert('Error', 'Please enter a sport');
      return;
    }
    setBookLoading(true);
    try {
      const res = await coachingAPI.bookSession({
        coach_id: selectedCoach.id,
        date: bookDate,
        slot: selectedSlot,
        sport: bookSport,
        notes: bookNotes.trim(),
      });
      const session = res.data;

      // Booked from package — no payment needed
      if (session.booked_from_package) {
        Alert.alert('Success', `Session booked from package! ${session.sessions_remaining} sessions remaining.`);
        setBookVisible(false);
        if (activeTab === 'sessions') loadSessions();
        loadMySubscriptions();
        setBookLoading(false);
        return;
      }

      if (session.payment_gateway === 'test') {
        // Test mode — auto-confirm
        try {
          await coachingAPI.testConfirm(session.id);
          Alert.alert('Success', 'Session booked & confirmed! (Test mode)');
        } catch { Alert.alert('Error', 'Failed to confirm session'); }
      } else if (session.payment_gateway === 'razorpay') {
        Alert.alert(
          'Payment Required',
          `Session fee of \u20B9${session.price} is required. Please complete payment on the web app to confirm your session.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Success', 'Session booked successfully!');
      }
      setBookVisible(false);
      if (activeTab === 'sessions') loadSessions();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to book session');
    } finally {
      setBookLoading(false);
    }
  };

  // -- Subscribe to Package --
  const handleSubscribe = async (pkg) => {
    setSubscribing(true);
    try {
      const res = await coachingAPI.subscribe(pkg.id);
      const sub = res.data;
      if (sub.payment_gateway === 'test') {
        await coachingAPI.testConfirmSub(sub.id);
        Alert.alert('Success', `Subscribed to ${pkg.name}! (Test mode)`);
        loadMySubscriptions();
        coachingAPI.getCoachPackages(selectedCoach.id).then(r => setCoachPackages(r.data || [])).catch(() => {});
      } else if (sub.payment_gateway === 'razorpay') {
        Alert.alert(
          'Payment Required',
          `Package subscription of \u20B9${pkg.price}/month requires payment. Please complete payment on the web app.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelSub = (subId) => {
    Alert.alert('Cancel Subscription', 'Are you sure? Remaining sessions are still usable until period ends.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            await coachingAPI.cancelSubscription(subId);
            Alert.alert('Done', 'Subscription cancelled.');
            loadMySubscriptions();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to cancel');
          }
        },
      },
    ]);
  };

  // -- Cancel Session --
  const handleCancel = (sessionId) => {
    Alert.alert('Cancel Session', 'Are you sure you want to cancel this session?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await coachingAPI.cancelSession(sessionId);
            Alert.alert('Done', 'Session cancelled.');
            loadSessions();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to cancel session');
          }
        },
      },
    ]);
  };

  // -- Review Flow --
  const openReviewModal = (session) => {
    setReviewSessionData(session);
    setReviewRating(5);
    setReviewComment('');
    setReviewVisible(true);
  };

  const handleReview = async () => {
    setReviewLoading(true);
    try {
      await coachingAPI.reviewSession(reviewSession.id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      Alert.alert('Thanks!', 'Your review has been submitted.');
      setReviewVisible(false);
      loadSessions();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to submit review');
    } finally {
      setReviewLoading(false);
    }
  };

  const upcomingSessions = sessions.filter((s) => s.status === 'confirmed' || s.status === 'pending');
  const pastSessions = sessions.filter((s) => s.status === 'completed' || s.status === 'cancelled');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>COACHING</Text>
          <Text style={styles.headerTitle}>Coaches</Text>
        </View>
      </View>

      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'find' && (
        <>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onSubmit={handleSearch}
            placeholder="Search coaches..."
            style={{ marginHorizontal: Spacing.base, marginBottom: Spacing.sm }}
          />
          <FilterChips
            items={SPORT_FILTERS}
            selected={selectedSport}
            onSelect={setSelectedSport}
            style={{ marginBottom: Spacing.sm }}
          />
        </>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'find' ? (
        <FlatList
          data={coaches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CoachCard coach={item} onBook={openBookModal} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={() => (
            <EmptyState
              icon="🏋️"
              title="No coaches found"
              subtitle="Try adjusting your search or filters"
            />
          )}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          {/* Active Subscriptions */}
          {mySubscriptions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Active Subscriptions</Text>
              {mySubscriptions.map((sub) => (
                <Card key={sub.id} style={[styles.sessionCard, { borderLeftWidth: 3, borderLeftColor: Colors.primary }]}>
                  <View style={styles.sessionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionCoach}>{sub.package_name}</Text>
                      <Text style={styles.sessionSport}>Coach: {sub.coach_name}</Text>
                      <Text style={styles.metaItem}>
                        {sub.sessions_remaining || (sub.sessions_per_month - (sub.sessions_used || 0))}/{sub.sessions_per_month} sessions left
                      </Text>
                      <Text style={styles.metaItem}>
                        Expires: {new Date(sub.current_period_end).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                    <Button size="sm" variant="outline" onPress={() => handleCancelSub(sub.id)}>Cancel</Button>
                  </View>
                </Card>
              ))}
            </>
          )}

          {sessions.length === 0 && mySubscriptions.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No sessions yet"
              subtitle="Book a session with a coach to get started"
              actionLabel="Find Coach"
              onAction={() => setActiveTab('find')}
            />
          ) : (
            <>
              {upcomingSessions.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Upcoming</Text>
                  {upcomingSessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onCancel={handleCancel}
                      onReview={openReviewModal}
                    />
                  ))}
                </>
              )}
              {pastSessions.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Past Sessions</Text>
                  {pastSessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onCancel={handleCancel}
                      onReview={openReviewModal}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Book Session Modal */}
      <ModalSheet visible={bookVisible} onClose={() => setBookVisible(false)} title="Book Session" maxHeight="90%">
        {selectedCoach && (
          <>
            {/* Coach Info Card */}
            <View style={styles.bookCoachCard}>
              <Avatar uri={selectedCoach.avatar} name={selectedCoach.name || ''} size={48} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.bookCoachName}>{selectedCoach.name}</Text>
                <StarRating rating={selectedCoach.rating} size={12} />
                <Text style={[styles.priceAmount, { fontSize: Typography.sm, marginTop: 4 }]}>
                  {'\u20B9'}{selectedCoach.price_per_session || 0}/session
                </Text>
              </View>
            </View>

            {/* Monthly Packages */}
            {coachPackages.length > 0 && (
              <>
                <Text style={styles.label}>Monthly Packages</Text>
                {coachPackages.map((pkg) => (
                  <Card key={pkg.id} style={{ padding: Spacing.md, marginBottom: Spacing.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookCoachName}>{pkg.name}</Text>
                        <Text style={styles.metaItem}>
                          {pkg.sessions_per_month} sessions/mo · {pkg.duration_minutes} min
                        </Text>
                        {pkg.description ? <Text style={styles.metaItem}>{pkg.description}</Text> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.priceAmount, { fontSize: Typography.sm }]}>{'\u20B9'}{pkg.price}/mo</Text>
                        {pkg.subscribed ? (
                          <Badge variant="default" style={{ marginTop: 4 }}>{pkg.sessions_remaining} left</Badge>
                        ) : (
                          <Button size="sm" onPress={() => handleSubscribe(pkg)} loading={subscribing} style={{ marginTop: 4 }}>
                            Subscribe
                          </Button>
                        )}
                      </View>
                    </View>
                  </Card>
                ))}
              </>
            )}

            {/* Date */}
            <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Date (YYYY-MM-DD)"
                  value={bookDate}
                  onChangeText={setBookDate}
                  placeholder="2026-03-01"
                />
              </View>
              <Button
                size="sm"
                variant="secondary"
                onPress={loadSlots}
                loading={slotsLoading}
                style={{ marginBottom: Spacing.md }}
              >
                Load Slots
              </Button>
            </View>

            {/* Available Slots */}
            {availableSlots.length > 0 && (
              <>
                <Text style={styles.label}>Available Slots</Text>
                <View style={styles.slotsGrid}>
                  {availableSlots.map((slot) => {
                    const slotValue = typeof slot === 'string' ? slot : slot.time || slot.slot;
                    const isAvailable = typeof slot === 'string' ? true : slot.available !== false;
                    const isSelected = selectedSlot === slotValue;
                    return (
                      <TouchableOpacity
                        key={slotValue}
                        style={[
                          styles.slotChip,
                          isSelected && styles.slotChipActive,
                          !isAvailable && styles.slotChipDisabled,
                        ]}
                        onPress={() => isAvailable && setSelectedSlot(slotValue)}
                        disabled={!isAvailable}
                      >
                        <Text
                          style={[
                            styles.slotChipText,
                            isSelected && { color: Colors.primary },
                            !isAvailable && { color: Colors.mutedForeground },
                          ]}
                        >
                          {slotValue}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {bookDate && !slotsLoading && availableSlots.length === 0 && (
              <Text style={styles.noSlotsText}>No available slots for this date. Try another date.</Text>
            )}

            {/* Sport */}
            <Input
              label="Sport"
              value={bookSport}
              onChangeText={setBookSport}
              placeholder="e.g. Football"
              autoCapitalize="words"
            />

            {/* Notes */}
            <Input
              label="Notes (optional)"
              value={bookNotes}
              onChangeText={setBookNotes}
              placeholder="Any specific requirements..."
              autoCapitalize="sentences"
              multiline
            />

            <Button onPress={handleBook} loading={bookLoading} style={{ marginTop: Spacing.sm }}>
              Book Session
            </Button>
          </>
        )}
      </ModalSheet>

      {/* Review Session Modal */}
      <ModalSheet visible={reviewVisible} onClose={() => setReviewVisible(false)} title="Review Session">
        {reviewSession && (
          <>
            <View style={styles.bookCoachCard}>
              <Avatar uri={reviewSession.coach_avatar} name={reviewSession.coach_name || ''} size={40} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.bookCoachName}>{reviewSession.coach_name}</Text>
                <Text style={styles.metaItem}>{reviewSession.date} - {reviewSession.sport}</Text>
              </View>
            </View>

            <Text style={styles.label}>Rating</Text>
            <View style={styles.ratingPicker}>
              {[1, 2, 3, 4, 5].map((val) => (
                <TouchableOpacity key={val} onPress={() => setReviewRating(val)} style={styles.ratingBtn}>
                  <Text style={{ fontSize: 28, color: val <= reviewRating ? Colors.amber : Colors.secondary }}>
                    {'★'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Comment (optional)"
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="How was your session?"
              autoCapitalize="sentences"
              multiline
            />

            <Button onPress={handleReview} loading={reviewLoading} style={{ marginTop: Spacing.sm }}>
              Submit Review
            </Button>
          </>
        )}
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  // Coach card
  coachCard: { padding: Spacing.md, marginBottom: Spacing.md },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  coachInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  coachName: {
    fontSize: Typography.base,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    marginBottom: 4,
  },
  coachSports: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ratingNum: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    color: Colors.amber,
  },
  coachPrice: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: Typography.base,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.primary,
  },
  priceUnit: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  coachMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  metaItem: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  coachFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  // Session card
  sessionCard: { padding: Spacing.md, marginBottom: Spacing.md },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionCoach: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  sessionSport: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  sessionMeta: {
    gap: 4,
    marginBottom: Spacing.sm,
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  // Booking modal
  bookCoachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusMd,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  bookCoachName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    marginBottom: 2,
  },
  label: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  slotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusFull,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.secondary,
  },
  slotChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  slotChipDisabled: {
    opacity: 0.4,
  },
  slotChipText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  noSlotsText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  // Review modal
  ratingPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  ratingBtn: {
    padding: Spacing.xs,
  },
});
