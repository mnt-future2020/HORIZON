import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Image, FlatList, RefreshControl, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { venueAPI } from '../api';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

function VenueCard({ venue, onPress }) {
  const rating = venue.average_rating ? venue.average_rating.toFixed(1) : null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.venueCard}>
      {/* Venue Image */}
      {venue.images?.length > 0 ? (
        <Image source={{ uri: venue.images[0] }} style={styles.venueImage} resizeMode="cover" />
      ) : (
        <View style={[styles.venueImage, styles.venuePlaceholder]}>
          <Text style={{ fontSize: 32 }}>🏟️</Text>
        </View>
      )}

      <View style={styles.venueContent}>
        <View style={styles.venueTitleRow}>
          <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
          {rating && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingStar}>⭐</Text>
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          )}
        </View>

        <View style={styles.venueMeta}>
          <Text style={styles.venueMetaText}>📍 {venue.area}{venue.city ? `, ${venue.city}` : ''}</Text>
        </View>

        <View style={styles.venueSports}>
          {(venue.sports || []).slice(0, 3).map(s => (
            <Badge key={s} variant="secondary" style={{ marginRight: 4, marginBottom: 4 }}>
              {s}
            </Badge>
          ))}
        </View>

        <View style={styles.venuePriceRow}>
          <Text style={styles.venuePrice}>
            ₹{(venue.base_price_per_hour || 0).toLocaleString('en-IN')}
            <Text style={styles.venuePriceUnit}>/hr</Text>
          </Text>
          {venue.amenities?.slice(0, 2).map(a => (
            <Text key={a} style={styles.amenity}>• {a}</Text>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const SPORTS = ['all', 'Football', 'Cricket', 'Basketball', 'Badminton', 'Tennis', 'Volleyball'];

export default function VenuesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState(route.params?.search || '');
  const [selectedSport, setSelectedSport] = useState('all');
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('all');

  const loadVenues = async () => {
    try {
      const params = {};
      if (searchText) params.search = searchText;
      if (selectedSport !== 'all') params.sport = selectedSport;
      if (selectedCity !== 'all') params.city = selectedCity;
      const res = await venueAPI.list(params);
      setVenues(res.data || []);
    } catch (err) {
      setVenues([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    venueAPI.cities().then(res => setCities(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    loadVenues();
  }, [selectedSport, selectedCity]);

  const handleSearch = () => {
    setLoading(true);
    loadVenues();
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadVenues();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerSub}>DISCOVER</Text>
        <Text style={styles.headerTitle}>Find Venues</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            placeholder="Search venue, area, city..."
            placeholderTextColor={Colors.mutedForeground}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setLoading(true); loadVenues(); }}>
              <Text style={{ color: Colors.mutedForeground, fontSize: 18, marginRight: 8 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sport Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {SPORTS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, selectedSport === s && styles.filterChipActive]}
            onPress={() => setSelectedSport(s)}
          >
            <Text style={[styles.filterChipText, selectedSport === s && styles.filterChipTextActive]}>
              {s === 'all' ? 'All Sports' : s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={venues}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <VenueCard
              venue={item}
              onPress={() => navigation.navigate('VenueDetail', { venueId: item.id, venueName: item.name })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 40, marginBottom: Spacing.md }}>🏟️</Text>
              <Text style={styles.emptyText}>No venues found</Text>
              <Text style={styles.emptySubText}>Try adjusting your filters</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: Typography.widest },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground, marginTop: 4, marginBottom: Spacing.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Spacing.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: {
    flex: 1, height: 44,
    color: Colors.foreground, fontSize: Typography.base,
    fontFamily: Typography.fontBody,
  },
  filterScroll: { flexGrow: 0 },
  filterContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusFull, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterChipText: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.mutedForeground },
  filterChipTextActive: { color: Colors.primary },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  venueCard: {
    backgroundColor: Colors.card, borderRadius: Spacing.radiusLg,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md, overflow: 'hidden',
  },
  venueImage: { width: '100%', height: 160, backgroundColor: Colors.secondary },
  venuePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  venueContent: { padding: Spacing.md },
  venueTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  venueName: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, flex: 1 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.amberLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Spacing.radiusFull },
  ratingStar: { fontSize: 10, marginRight: 2 },
  ratingText: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, color: Colors.amber },
  venueMeta: { marginBottom: 8 },
  venueMetaText: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  venueSports: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  venuePriceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  venuePrice: { fontSize: Typography.base, fontFamily: Typography.fontDisplayBlack, color: Colors.primary },
  venuePriceUnit: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  amenity: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground },
  emptySubText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
});
