import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl, Animated, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import ModalSheet from '../../components/common/ModalSheet';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

// liveAPI - imported from api index; if not yet exported, define inline fallback
let liveAPI;
try {
  liveAPI = require('../../api').liveAPI;
} catch (_) { /* handled below */ }
if (!liveAPI) {
  const api = require('../../api').default;
  liveAPI = {
    get: (id) => api.get(`/live/${id}`),
    updateScore: (id, data) => api.post(`/live/${id}/score`, data),
    addEvent: (id, data) => api.post(`/live/${id}/event`, data),
    pause: (id) => api.post(`/live/${id}/pause`),
    end: (id) => api.post(`/live/${id}/end`),
    changePeriod: (id, data) => api.post(`/live/${id}/period`, data),
  };
}

const QUICK_EVENTS = [
  { key: 'goal', emoji: '\u26BD', label: 'Goal' },
  { key: 'card', emoji: '\uD83D\uDFE8', label: 'Card' },
  { key: 'foul', emoji: '\u26A0\uFE0F', label: 'Foul' },
  { key: 'point', emoji: '\uD83C\uDFAF', label: 'Point' },
  { key: 'ace', emoji: '\uD83D\uDD25', label: 'Ace' },
  { key: 'timeout', emoji: '\u23F8', label: 'Timeout' },
];

export default function LiveScoringScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();

  const { liveMatchId, tournamentId, organizerId } = route.params || {};
  const isScorer = user?.id === organizerId;

  // ---------- State ----------
  const [matchData, setMatchData] = useState(null);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [eventForm, setEventForm] = useState({ team: 'home', player: '', minute: '', description: '' });

  const wsRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const retryRef = useRef(0);

  // ---------- Derive WS URL ----------
  const apiModule = require('../../api');
  const API_BASE = apiModule.default?.defaults?.baseURL || '';
  const WS_BASE = API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '/api/live/ws');

  // ---------- Pulse animation ----------
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  // ---------- WebSocket ----------
  const connectWs = useCallback(() => {
    if (!liveMatchId) return;
    const ws = new WebSocket(`${WS_BASE}/${liveMatchId}`);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); retryRef.current = 0; };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'initial_state') {
        setMatchData(msg);
        setEvents(msg.events || []);
        setSpectatorCount(msg.spectator_count || 0);
      } else if (msg.type === 'score_update') {
        setMatchData((prev) =>
          prev ? { ...prev, home: msg.home, away: msg.away, status: msg.status, period: msg.period, period_label: msg.period_label } : prev,
        );
        setSpectatorCount(msg.spectator_count || 0);
      } else if (msg.type === 'event') {
        setEvents((prev) => [...prev, msg.event]);
        setMatchData((prev) =>
          prev ? { ...prev, home: msg.home, away: msg.away, status: msg.status } : prev,
        );
        setSpectatorCount(msg.spectator_count || 0);
      } else if (msg.type === 'period_change') {
        setMatchData((prev) =>
          prev ? { ...prev, period: msg.period, period_label: msg.period_label, status: msg.status } : prev,
        );
      } else if (msg.type === 'status_change') {
        setMatchData((prev) => (prev ? { ...prev, status: msg.status } : prev));
      } else if (msg.type === 'spectator_count') {
        setSpectatorCount(msg.spectator_count || 0);
      }
    };
    ws.onclose = () => {
      setConnected(false);
      const delay = Math.min(1000 * Math.pow(2, retryRef.current), 15000);
      retryRef.current += 1;
      setTimeout(connectWs, delay);
    };
    ws.onerror = () => ws.close();
  }, [liveMatchId]);

  useEffect(() => {
    connectWs();
    // REST fallback for initial load
    liveAPI
      .get(liveMatchId)
      .then((r) => {
        setMatchData((prev) => prev || r.data);
        setEvents((prev) => (prev.length ? prev : r.data.events || []));
        setSpectatorCount((prev) => prev || r.data.spectator_count || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  // ---------- Scorer actions ----------
  const handleScore = async (team, delta) => {
    try { await liveAPI.updateScore(liveMatchId, { team, delta }); }
    catch { Alert.alert('Error', 'Failed to update score'); }
  };

  const handleEvent = async () => {
    const payload = {
      type: selectedEventType,
      team: eventForm.team,
      player: eventForm.player,
      minute: eventForm.minute ? parseInt(eventForm.minute, 10) : undefined,
      description: eventForm.description || `${selectedEventType} - ${eventForm.team}`,
    };
    try {
      await liveAPI.addEvent(liveMatchId, payload);
      setShowEventModal(false);
      setEventForm({ team: 'home', player: '', minute: '', description: '' });
      setSelectedEventType(null);
    } catch {
      Alert.alert('Error', 'Failed to add event');
    }
  };

  const handlePause = async () => {
    try { await liveAPI.pause(liveMatchId); }
    catch { Alert.alert('Error', 'Failed to pause/resume'); }
  };

  const handleEndMatch = () => {
    Alert.alert('End Match', 'Final scores will be submitted to the tournament. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Match',
        style: 'destructive',
        onPress: async () => {
          try {
            await liveAPI.end(liveMatchId);
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Failed to end match');
          }
        },
      },
    ]);
  };

  const handlePeriod = async () => {
    const next = (matchData?.period || 1) + 1;
    try {
      await liveAPI.changePeriod(liveMatchId, { period: next, period_label: `Period ${next}` });
    } catch { /* silent */ }
  };

  const openEventModal = (type) => {
    setSelectedEventType(type);
    setEventForm({ team: 'home', player: '', minute: '', description: '' });
    setShowEventModal(true);
  };

  // ---------- Render helpers ----------
  const isPaused = matchData?.status === 'paused';
  const isEnded = matchData?.status === 'ended' || matchData?.status === 'completed';

  const renderEventItem = ({ item }) => {
    const isHome = item.team === 'home';
    return (
      <View style={styles.eventItem}>
        <View style={[styles.eventDot, { backgroundColor: isHome ? Colors.primary : Colors.accent }]} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            {item.minute != null && (
              <Text style={styles.eventMinute}>{item.minute}'</Text>
            )}
            <Text style={styles.eventType}>{item.type || item.event_type}</Text>
          </View>
          <Text style={styles.eventDesc} numberOfLines={2}>
            {item.description || item.player || ''}
          </Text>
        </View>
      </View>
    );
  };

  // ---------- Loading state ----------
  if (loading && !matchData) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Connecting to match...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Main Render ----------
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ======== HEADER ======== */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Animated.View style={[styles.liveBadge, { opacity: pulseAnim }]}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </Animated.View>
          <Text style={styles.spectatorText}>
            {spectatorCount} watching
          </Text>
        </View>

        <View style={[styles.connectionDot, { backgroundColor: connected ? Colors.emerald : Colors.destructive }]} />
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ======== SCORE DISPLAY ======== */}
        <Card style={styles.scoreCard} variant="elevated">
          {matchData?.period_label && (
            <Text style={styles.periodLabel}>{matchData.period_label}</Text>
          )}
          <View style={styles.scoreRow}>
            {/* Home */}
            <View style={styles.teamCol}>
              <Text style={styles.teamName} numberOfLines={1}>
                {matchData?.home_name || 'Home'}
              </Text>
            </View>
            <Text style={styles.scoreText}>
              {matchData?.home ?? 0}
            </Text>
            <Text style={styles.scoreDash}>{'\u2014'}</Text>
            <Text style={styles.scoreText}>
              {matchData?.away ?? 0}
            </Text>
            {/* Away */}
            <View style={styles.teamCol}>
              <Text style={styles.teamName} numberOfLines={1}>
                {matchData?.away_name || 'Away'}
              </Text>
            </View>
          </View>
          {isEnded && <Badge variant="secondary" style={styles.endedBadge}>FINAL</Badge>}
          {isPaused && <Badge variant="amber" style={styles.endedBadge}>PAUSED</Badge>}
        </Card>

        {/* ======== SCORER CONTROLS ======== */}
        {isScorer && !isEnded && (
          <View style={styles.scorerSection}>
            {/* +/- Buttons */}
            <View style={styles.scoreControls}>
              <View style={styles.teamScoreCtrl}>
                <Text style={styles.ctrlLabel}>Home</Text>
                <View style={styles.plusMinusRow}>
                  <TouchableOpacity style={[styles.circleBtn, styles.minusBtn]} onPress={() => handleScore('home', -1)}>
                    <Text style={styles.circleBtnText}>{'\u2212'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.circleBtn, styles.plusBtn]} onPress={() => handleScore('home', 1)}>
                    <Text style={styles.circleBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.teamScoreCtrl}>
                <Text style={styles.ctrlLabel}>Away</Text>
                <View style={styles.plusMinusRow}>
                  <TouchableOpacity style={[styles.circleBtn, styles.minusBtn]} onPress={() => handleScore('away', -1)}>
                    <Text style={styles.circleBtnText}>{'\u2212'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.circleBtn, styles.plusBtn]} onPress={() => handleScore('away', 1)}>
                    <Text style={styles.circleBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Quick event buttons */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickEventsScroll} contentContainerStyle={styles.quickEventsContent}>
              {QUICK_EVENTS.map((ev) => (
                <TouchableOpacity key={ev.key} style={styles.quickEventPill} onPress={() => openEventModal(ev.key)}>
                  <Text style={styles.quickEventEmoji}>{ev.emoji}</Text>
                  <Text style={styles.quickEventLabel}>{ev.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Period / Pause / End row */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.periodBtn} onPress={handlePeriod}>
                <Text style={styles.periodBtnText}>Next Period</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pauseBtn, isPaused && styles.pauseBtnActive]} onPress={handlePause}>
                <Text style={styles.pauseBtnText}>{isPaused ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>
            </View>
            <Button variant="destructive" onPress={handleEndMatch} style={styles.endMatchBtn}>
              End Match
            </Button>
          </View>
        )}

        {/* ======== EVENT TIMELINE ======== */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Event Timeline</Text>
          {events.length === 0 ? (
            <Text style={styles.noEvents}>No events yet</Text>
          ) : (
            <FlatList
              data={[...events].reverse()}
              keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
              renderItem={renderEventItem}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.eventSep} />}
            />
          )}
        </View>
      </ScrollView>

      {/* ======== EVENT FORM MODAL ======== */}
      <ModalSheet visible={showEventModal} onClose={() => setShowEventModal(false)} title={`Add ${selectedEventType || 'Event'}`}>
        {/* Team Selector */}
        <Text style={styles.formLabel}>Team</Text>
        <View style={styles.teamSelector}>
          <TouchableOpacity
            style={[styles.teamOption, eventForm.team === 'home' && styles.teamOptionActive]}
            onPress={() => setEventForm((f) => ({ ...f, team: 'home' }))}
          >
            <Text style={[styles.teamOptionText, eventForm.team === 'home' && styles.teamOptionTextActive]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.teamOption, eventForm.team === 'away' && styles.teamOptionAway]}
            onPress={() => setEventForm((f) => ({ ...f, team: 'away' }))}
          >
            <Text style={[styles.teamOptionText, eventForm.team === 'away' && styles.teamOptionTextActive]}>Away</Text>
          </TouchableOpacity>
        </View>

        {/* Player name */}
        <Text style={styles.formLabel}>Player Name</Text>
        <TextInput
          style={styles.formInput}
          value={eventForm.player}
          onChangeText={(t) => setEventForm((f) => ({ ...f, player: t }))}
          placeholder="e.g. John Smith"
          placeholderTextColor={Colors.mutedForeground}
        />

        {/* Minute */}
        <Text style={styles.formLabel}>Minute</Text>
        <TextInput
          style={styles.formInput}
          value={eventForm.minute}
          onChangeText={(t) => setEventForm((f) => ({ ...f, minute: t }))}
          placeholder="e.g. 45"
          placeholderTextColor={Colors.mutedForeground}
          keyboardType="number-pad"
        />

        {/* Description */}
        <Text style={styles.formLabel}>Description (optional)</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMultiline]}
          value={eventForm.description}
          onChangeText={(t) => setEventForm((f) => ({ ...f, description: t }))}
          placeholder="Additional details..."
          placeholderTextColor={Colors.mutedForeground}
          multiline
        />

        <Button onPress={handleEvent} style={styles.submitEventBtn}>
          Submit Event
        </Button>
      </ModalSheet>
    </SafeAreaView>
  );
}

// ============================== STYLES ==============================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.mutedForeground,
    fontFamily: Typography.fontBody,
    fontSize: Typography.base,
    marginTop: Spacing.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrow: {
    fontSize: 24,
    color: Colors.foreground,
    fontFamily: Typography.fontBodyBold,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveBadge: {
    backgroundColor: Colors.rose,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Spacing.radiusFull,
  },
  liveBadgeText: {
    color: Colors.white,
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    letterSpacing: Typography.wider,
  },
  spectatorText: {
    color: Colors.mutedForeground,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Score card
  scrollBody: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl4 },
  scoreCard: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  periodLabel: {
    color: Colors.mutedForeground,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: Typography.wider,
    marginBottom: Spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    color: Colors.mutedForeground,
    fontSize: Typography.base,
    fontFamily: Typography.fontBodyMedium,
    textAlign: 'center',
  },
  scoreText: {
    color: Colors.foreground,
    fontSize: 52,
    fontFamily: Typography.fontDisplayBlack,
    lineHeight: 60,
  },
  scoreDash: {
    color: Colors.mutedForeground,
    fontSize: 28,
    fontFamily: Typography.fontDisplay,
    marginHorizontal: Spacing.xs,
  },
  endedBadge: {
    marginTop: Spacing.md,
    alignSelf: 'center',
  },

  // Scorer controls
  scorerSection: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.lg,
  },
  scoreControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.base,
  },
  teamScoreCtrl: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ctrlLabel: {
    color: Colors.mutedForeground,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: Typography.wider,
  },
  plusMinusRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtn: {
    backgroundColor: Colors.primary,
  },
  minusBtn: {
    backgroundColor: Colors.destructive,
  },
  circleBtnText: {
    color: Colors.white,
    fontSize: 22,
    fontFamily: Typography.fontDisplayBold || Typography.fontDisplay,
    lineHeight: 24,
  },

  // Quick events
  quickEventsScroll: {
    marginBottom: Spacing.base,
  },
  quickEventsContent: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  quickEventPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusFull,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  quickEventEmoji: {
    fontSize: 16,
  },
  quickEventLabel: {
    color: Colors.foreground,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyMedium,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  periodBtn: {
    flex: 1,
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusMd,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodBtnText: {
    color: Colors.foreground,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pauseBtn: {
    flex: 1,
    backgroundColor: Colors.amberLight,
    borderRadius: Spacing.radiusMd,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.amber,
  },
  pauseBtnActive: {
    backgroundColor: Colors.amber,
  },
  pauseBtnText: {
    color: Colors.amber,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  endMatchBtn: {
    marginTop: Spacing.xs,
  },

  // Timeline
  timelineSection: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.foreground,
    fontSize: Typography.lg,
    fontFamily: Typography.fontDisplay,
    marginBottom: Spacing.md,
  },
  noEvents: {
    color: Colors.mutedForeground,
    fontSize: Typography.base,
    fontFamily: Typography.fontBody,
    textAlign: 'center',
    paddingVertical: Spacing.xl2,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusMd,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: Spacing.md,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  eventMinute: {
    color: Colors.amber,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
  },
  eventType: {
    color: Colors.foreground,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodySemiBold,
    textTransform: 'capitalize',
  },
  eventDesc: {
    color: Colors.mutedForeground,
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
  },
  eventSep: {
    height: Spacing.sm,
  },

  // Event form modal
  formLabel: {
    color: Colors.foreground,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodySemiBold,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  teamSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  teamOption: {
    flex: 1,
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusMd,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teamOptionActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  teamOptionAway: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  teamOptionText: {
    color: Colors.mutedForeground,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodySemiBold,
  },
  teamOptionTextActive: {
    color: Colors.foreground,
  },
  formInput: {
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Spacing.radiusMd,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.foreground,
    fontSize: Typography.base,
    fontFamily: Typography.fontBody,
  },
  formInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  submitEventBtn: {
    marginTop: Spacing.lg,
  },
});
