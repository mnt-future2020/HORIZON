import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { venueAPI, bookingAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

function SlotGrid({ slots, selectedSlot, onSelect, selectedDate }) {
  if (!slots.length) return (
    <View style={styles.noSlots}>
      <Text style={styles.noSlotsText}>No slots available for this date</Text>
    </View>
  );

  return (
    <View style={styles.slotGrid}>
      {slots.map((slot, i) => {
        const isSelected = selectedSlot?.start_time === slot.start_time;
        const isBooked = slot.status === 'booked' || slot.status === 'locked';
        return (
          <TouchableOpacity
            key={i}
            disabled={isBooked}
            onPress={() => onSelect(isSelected ? null : slot)}
            style={[
              styles.slotChip,
              isSelected && styles.slotChipSelected,
              isBooked && styles.slotChipBooked,
            ]}
          >
            <Text style={[
              styles.slotText,
              isSelected && styles.slotTextSelected,
              isBooked && styles.slotTextBooked,
            ]}>
              {slot.start_time}
            </Text>
            {!isBooked && (
              <Text style={[styles.slotPrice, isSelected && { color: Colors.primaryForeground }]}>
                ₹{slot.price || 0}
              </Text>
            )}
            {isBooked && <Text style={styles.slotBookedTag}>Booked</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DatePicker({ selectedDate, onSelect }) {
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  const fmt = (d) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return { day: days[d.getDay()], date: d.getDate(), month: d.toLocaleString('default', { month: 'short' }) };
  };

  const toISO = (d) => d.toISOString().split('T')[0];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker} contentContainerStyle={{ gap: Spacing.sm }}>
      {dates.map((d, i) => {
        const f = fmt(d);
        const iso = toISO(d);
        const isSelected = selectedDate === iso;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSelect(iso)}
            style={[styles.dateChip, isSelected && styles.dateChipActive]}
          >
            <Text style={[styles.dateDay, isSelected && { color: Colors.primaryForeground }]}>{f.day}</Text>
            <Text style={[styles.dateNum, isSelected && { color: Colors.primaryForeground }]}>{f.date}</Text>
            <Text style={[styles.dateMonth, isSelected && { color: Colors.primaryForeground }]}>{f.month}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function VenueDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { venueId } = route.params;

  const [venue, setVenue] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    venueAPI.get(venueId)
      .then(res => setVenue(res.data))
      .catch(() => Alert.alert('Error', 'Venue not found'))
      .finally(() => setLoading(false));
    venueAPI.getReviews(venueId).then(res => setReviews(res.data || [])).catch(() => {});
    venueAPI.getReviewSummary(venueId).then(res => setReviewSummary(res.data)).catch(() => {});
  }, [venueId]);

  useEffect(() => {
    if (!venueId) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    venueAPI.getSlots(venueId, selectedDate)
      .then(res => setSlots(res.data || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [venueId, selectedDate]);

  const handleBook = async () => {
    if (!selectedSlot) {
      Alert.alert('Select a slot', 'Please select a time slot to continue');
      return;
    }
    setBooking(true);
    try {
      const res = await bookingAPI.create({
        venue_id: venueId,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        sport: venue?.sports?.[0] || 'Football',
        payment_mode: 'full',
        total_amount: selectedSlot.price || venue?.base_price_per_hour || 0,
      });
      // Mock confirm for demo
      await bookingAPI.mockConfirm(res.data.id);
      setConfirmResult(res.data);
    } catch (err) {
      Alert.alert('Booking Failed', err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!venue) return null;

  const avgRating = reviewSummary?.average_rating;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        {venue.images?.length > 0 ? (
          <View>
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width))}
            >
              {venue.images.map((img, i) => (
                <Image key={i} source={{ uri: img }} style={styles.heroImage} resizeMode="cover" />
              ))}
            </ScrollView>
            {venue.images.length > 1 && (
              <View style={styles.imageDots}>
                {venue.images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Text style={{ fontSize: 48 }}>🏟️</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Venue Info */}
          <View style={styles.infoSection}>
            <View style={styles.titleRow}>
              <Text style={styles.venueName}>{venue.name}</Text>
              {avgRating && (
                <View style={styles.ratingBox}>
                  <Text style={styles.ratingStar}>⭐</Text>
                  <Text style={styles.ratingText}>{avgRating.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>({reviewSummary?.total_reviews})</Text>
                </View>
              )}
            </View>

            <View style={styles.locationRow}>
              <Text style={styles.location}>📍 {venue.area}{venue.city ? `, ${venue.city}` : ''}</Text>
            </View>

            {/* Sports */}
            <View style={styles.sportsRow}>
              {(venue.sports || []).map(s => (
                <Badge key={s} variant="default" style={{ marginRight: 6, marginBottom: 4 }}>{s}</Badge>
              ))}
            </View>

            {/* Price */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{(venue.base_price_per_hour || 0).toLocaleString('en-IN')}</Text>
              <Text style={styles.priceUnit}>/hour</Text>
            </View>

            {/* Description */}
            {venue.description && (
              <Text style={styles.description}>{venue.description}</Text>
            )}

            {/* Amenities */}
            {venue.amenities?.length > 0 && (
              <View style={styles.amenitiesBox}>
                <Text style={styles.subheading}>Amenities</Text>
                <View style={styles.amenityRow}>
                  {venue.amenities.map(a => (
                    <View key={a} style={styles.amenityChip}>
                      <Text style={styles.amenityText}>✓ {a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Date Selection */}
          <View style={styles.bookingSection}>
            <Text style={styles.subheading}>Select Date</Text>
            <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
          </View>

          {/* Time Slots */}
          <View style={styles.bookingSection}>
            <Text style={styles.subheading}>Available Slots</Text>
            {slotsLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: Spacing.xl }} />
            ) : (
              <SlotGrid slots={slots} selectedSlot={selectedSlot} onSelect={setSelectedSlot} selectedDate={selectedDate} />
            )}
          </View>

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={styles.subheading}>Reviews</Text>
              {reviews.slice(0, 3).map(r => (
                <Card key={r.id} style={{ marginBottom: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={styles.reviewAuthor}>{r.user_name || 'Player'}</Text>
                    <Text style={styles.reviewRating}>{'⭐'.repeat(r.rating)}</Text>
                  </View>
                  {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Booking Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {selectedSlot ? (
            <>
              <Text style={styles.footerSlotTime}>{selectedSlot.start_time} – {selectedSlot.end_time}</Text>
              <Text style={styles.footerPrice}>₹{(selectedSlot.price || venue.base_price_per_hour || 0).toLocaleString('en-IN')}</Text>
            </>
          ) : (
            <Text style={styles.footerHint}>Select a time slot</Text>
          )}
        </View>
        <Button onPress={handleBook} loading={booking} style={{ flex: 1, maxWidth: 180 }}>
          Book Now
        </Button>
      </View>

      {/* Booking Confirmation Modal */}
      <Modal visible={!!confirmResult} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>✅</Text>
            <Text style={styles.modalTitle}>Booking Confirmed!</Text>
            <Text style={styles.modalSub}>{venue.name}</Text>
            <Text style={styles.modalMeta}>
              {selectedDate} • {confirmResult?.start_time} – {confirmResult?.end_time}
            </Text>
            <Text style={styles.modalAmount}>
              ₹{(confirmResult?.total_amount || 0).toLocaleString('en-IN')}
            </Text>
            <View style={{ gap: Spacing.sm, width: '100%', marginTop: Spacing.lg }}>
              <Button onPress={() => { setConfirmResult(null); navigation.navigate('Bookings'); }}>
                View Bookings
              </Button>
              <Button variant="ghost" onPress={() => { setConfirmResult(null); setSelectedSlot(null); }}>
                Book Another
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  heroImage: { width: '100%', height: 240, backgroundColor: Colors.secondary },
  heroPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  imageDots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: Colors.white, width: 18 },
  content: { padding: Spacing.base },
  infoSection: { marginBottom: Spacing.xl },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  venueName: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, flex: 1, marginRight: Spacing.sm },
  ratingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.amberLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Spacing.radiusFull },
  ratingStar: { fontSize: 12 },
  ratingText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.amber, marginLeft: 2 },
  ratingCount: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginLeft: 2 },
  locationRow: { marginBottom: Spacing.sm },
  location: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  sportsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: Spacing.md },
  price: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  priceUnit: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginLeft: 4 },
  description: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, lineHeight: 20, marginBottom: Spacing.md },
  amenitiesBox: { marginTop: Spacing.sm },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  amenityChip: { backgroundColor: Colors.secondary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Spacing.radiusFull, borderWidth: 1, borderColor: Colors.border },
  amenityText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  subheading: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginBottom: Spacing.md },
  bookingSection: { marginBottom: Spacing.xl },
  datePicker: { flexGrow: 0, marginBottom: Spacing.sm },
  dateChip: { width: 52, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: Spacing.radiusLg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  dateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateDay: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1 },
  dateNum: { fontSize: Typography.lg, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  dateMonth: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slotChip: { width: '30%', padding: Spacing.sm, borderRadius: Spacing.radiusMd, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center' },
  slotChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotChipBooked: { backgroundColor: Colors.secondary, opacity: 0.5 },
  slotText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  slotTextSelected: { color: Colors.primaryForeground },
  slotTextBooked: { color: Colors.mutedForeground },
  slotPrice: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.primary, marginTop: 2 },
  slotBookedTag: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 2 },
  noSlots: { paddingVertical: Spacing.xl, alignItems: 'center' },
  noSlotsText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  reviewsSection: { marginBottom: Spacing.xl },
  reviewAuthor: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  reviewRating: { fontSize: Typography.xs },
  reviewComment: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border },
  footerLeft: { flex: 1 },
  footerSlotTime: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  footerPrice: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  footerHint: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalCard: { backgroundColor: Colors.card, borderRadius: Spacing.radiusXl, padding: Spacing.xl2, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modalIcon: { fontSize: 48, marginBottom: Spacing.md },
  modalTitle: { fontSize: Typography.xl2, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, textAlign: 'center' },
  modalSub: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.primary, marginTop: 6 },
  modalMeta: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
  modalAmount: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.primary, marginTop: Spacing.md },
});
