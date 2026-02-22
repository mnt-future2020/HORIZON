import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { tournamentAPI, liveAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Avatar from '../../components/common/Avatar';
import TabBar from '../../components/common/TabBar';
import ModalSheet from '../../components/common/ModalSheet';
import EmptyState from '../../components/common/EmptyState';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const FORMAT_LABELS = {
  knockout: 'Knockout',
  round_robin: 'Round Robin',
  league: 'League',
};

function getStatusBadgeVariant(status) {
  switch (status) {
    case 'registration_open': return 'default';
    case 'in_progress': return 'amber';
    case 'completed': return 'secondary';
    case 'cancelled': return 'destructive';
    default: return 'outline';
  }
}

function getRoundName(roundIdx, totalRounds) {
  const fromEnd = totalRounds - roundIdx;
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Semi-Final';
  if (fromEnd === 3) return 'Quarter-Final';
  return `Round ${roundIdx + 1}`;
}

// -- Bracket Tab (Knockout) --
function BracketTab({ tournament }) {
  const rounds = tournament.bracket || tournament.rounds || [];

  if (!rounds.length) {
    return (
      <EmptyState
        icon="🏆"
        title="Bracket not available"
        subtitle="The bracket will appear once the tournament starts"
      />
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bracketScroll}>
      {rounds.map((round, rIdx) => (
        <View key={rIdx} style={styles.bracketRound}>
          <Text style={styles.roundTitle}>{getRoundName(rIdx, rounds.length)}</Text>
          {(round.matches || []).map((match, mIdx) => (
            <View key={mIdx} style={styles.bracketMatch}>
              <View style={styles.bracketSlot}>
                <Text style={[styles.bracketPlayer, match.winner === match.player1_id && { color: Colors.primary }]} numberOfLines={1}>
                  {match.player1_name || 'TBD'}
                </Text>
                <Text style={styles.bracketScore}>{match.score1 != null ? match.score1 : '-'}</Text>
              </View>
              <View style={styles.bracketDivider} />
              <View style={styles.bracketSlot}>
                <Text style={[styles.bracketPlayer, match.winner === match.player2_id && { color: Colors.primary }]} numberOfLines={1}>
                  {match.player2_name || 'TBD'}
                </Text>
                <Text style={styles.bracketScore}>{match.score2 != null ? match.score2 : '-'}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// -- Standings Tab (Round Robin / League) --
function StandingsTab({ tournamentId }) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tournamentAPI.standings(tournamentId)
      .then((res) => setStandings(res.data || []))
      .catch(() => setStandings([]))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  if (loading) {
    return <View style={styles.loadingBox}><ActivityIndicator size="small" color={Colors.primary} /></View>;
  }

  if (!standings.length) {
    return (
      <EmptyState
        icon="📊"
        title="No standings yet"
        subtitle="Standings will appear once matches are played"
      />
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.tableHeader}>
          {['#', 'Name', 'P', 'W', 'D', 'L', 'GF', 'GA', 'Pts'].map((col) => (
            <Text
              key={col}
              style={[
                styles.tableHeaderCell,
                col === 'Name' ? { flex: 1, minWidth: 120, textAlign: 'left' } : { width: 40, textAlign: 'center' },
              ]}
            >
              {col}
            </Text>
          ))}
        </View>
        {standings.map((row, idx) => (
          <View key={row.player_id || idx} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: Colors.secondary }]}>
            <Text style={[styles.tableCell, { width: 40, textAlign: 'center', color: idx < 3 ? Colors.primary : Colors.foreground }]}>
              {row.rank || idx + 1}
            </Text>
            <Text style={[styles.tableCell, { flex: 1, minWidth: 120, textAlign: 'left' }]} numberOfLines={1}>
              {row.player_name || row.name || 'Unknown'}
            </Text>
            {[row.played, row.wins, row.draws, row.losses, row.goals_for, row.goals_against, row.points].map((val, i) => (
              <Text key={i} style={[styles.tableCell, { width: 40, textAlign: 'center' }]}>
                {val != null ? val : 0}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// -- Matches Tab --
function MatchesTab({ tournament, isOrganizer, onSubmitResult }) {
  const matches = tournament.matches || [];

  if (!matches.length) {
    return (
      <EmptyState
        icon="vs"
        title="No matches yet"
        subtitle="Matches will appear once the tournament starts"
      />
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {matches.map((match) => (
        <Card key={match.id} style={styles.matchCard}>
          <View style={styles.matchRow}>
            <View style={styles.matchTeam}>
              <Text style={styles.matchPlayerName} numberOfLines={1}>{match.player1_name || 'TBD'}</Text>
              <Text style={[styles.matchScore, match.winner === match.player1_id && { color: Colors.primary }]}>
                {match.score1 != null ? match.score1 : '-'}
              </Text>
            </View>
            <Text style={styles.matchVs}>vs</Text>
            <View style={[styles.matchTeam, { alignItems: 'flex-end' }]}>
              <Text style={styles.matchPlayerName} numberOfLines={1}>{match.player2_name || 'TBD'}</Text>
              <Text style={[styles.matchScore, match.winner === match.player2_id && { color: Colors.primary }]}>
                {match.score2 != null ? match.score2 : '-'}
              </Text>
            </View>
          </View>
          <View style={styles.matchFooter}>
            <Badge variant={match.status === 'completed' ? 'secondary' : match.status === 'in_progress' ? 'amber' : 'outline'}>
              {match.status?.replace(/_/g, ' ') || 'Pending'}
            </Badge>
            {isOrganizer && match.status !== 'completed' && (
              <Button size="sm" variant="secondary" onPress={() => onSubmitResult(match)}>
                Submit Result
              </Button>
            )}
          </View>
        </Card>
      ))}
    </View>
  );
}

// -- Players Tab --
function PlayersTab({ participants }) {
  if (!participants?.length) {
    return (
      <EmptyState
        icon="👥"
        title="No participants yet"
        subtitle="Players will appear when they register"
      />
    );
  }

  return (
    <View style={{ gap: Spacing.xs }}>
      {participants.map((p, idx) => (
        <View key={p.id || idx} style={styles.playerRow}>
          <Avatar uri={p.avatar} name={p.name || ''} size={40} />
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>{p.name || 'Unknown'}</Text>
            {p.rating != null && (
              <Text style={styles.playerRating}>{p.rating} rating</Text>
            )}
          </View>
          <Text style={styles.playerIdx}>#{idx + 1}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TournamentDetailScreen() {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const { tournamentId } = route.params;

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [liveMatches, setLiveMatches] = useState([]);

  const isOrganizer = tournament?.organizer_id === user?.id;
  const isRegistered = tournament?.participants?.some((p) => p.id === user?.id);
  const participantCount = tournament?.participant_count || tournament?.participants?.length || 0;
  const statusLabel = tournament?.status?.replace(/_/g, ' ') || '';

  const getTabs = useCallback(() => {
    if (!tournament) return [];
    const liveTab = tournament.status === 'in_progress'
      ? [{ key: 'live', label: '🔴 Live' }] : [];
    if (tournament.format === 'knockout') {
      return [
        ...liveTab,
        { key: 'bracket', label: 'Bracket' },
        { key: 'players', label: 'Players' },
      ];
    }
    return [
      ...liveTab,
      { key: 'standings', label: 'Standings' },
      { key: 'matches', label: 'Matches' },
      { key: 'players', label: 'Players' },
    ];
  }, [tournament]);

  const loadData = useCallback(async () => {
    try {
      const res = await tournamentAPI.get(tournamentId);
      setTournament(res.data);
      const baseTabs = res.data?.format === 'knockout'
        ? ['bracket', 'players']
        : ['standings', 'matches', 'players'];
      // Add Live tab if tournament is in progress
      const tabs = res.data?.status === 'in_progress'
        ? ['live', ...baseTabs]
        : baseTabs;
      if (!activeTab || !tabs.includes(activeTab)) {
        setActiveTab(tabs[0]);
      }
      // Load live matches if in progress
      if (res.data?.status === 'in_progress') {
        try {
          const liveRes = await liveAPI.getActive();
          setLiveMatches((liveRes.data || []).filter(m => m.tournament_id === tournamentId));
        } catch {}
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load tournament details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (tournament?.status !== 'in_progress') return;
    const interval = setInterval(async () => {
      try {
        const res = await liveAPI.getActive();
        setLiveMatches((res.data || []).filter(m => m.tournament_id === tournamentId));
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [tournament?.status, tournamentId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRegister = async () => {
    try {
      const res = await tournamentAPI.register(tournamentId);
      const data = res.data;

      if (data.payment_gateway === "test" && data.payment_status === "pending") {
        // Test mode — auto-confirm entry fee
        try {
          await tournamentAPI.testConfirmEntry(tournamentId);
          Alert.alert('Success', 'Entry fee confirmed (Test mode). You are registered!');
        } catch { Alert.alert('Error', 'Failed to confirm entry'); }
        loadData();
      } else if (data.payment_status === "pending") {
        // Real payment required — prompt user
        Alert.alert(
          'Payment Required',
          `Entry fee of \u20B9${data.entry_fee} is required. Please complete payment on the web app to confirm registration.`,
          [{ text: 'OK' }]
        );
        loadData();
      } else {
        Alert.alert('Success', 'You have registered for this tournament!');
        loadData();
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to register');
    }
  };

  const handleWithdraw = async () => {
    Alert.alert('Withdraw', 'Are you sure you want to withdraw from this tournament?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await tournamentAPI.withdraw(tournamentId);
            Alert.alert('Done', 'You have withdrawn from the tournament.');
            loadData();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to withdraw');
          }
        },
      },
    ]);
  };

  const handleStart = async () => {
    Alert.alert('Start Tournament', 'Are you sure you want to start this tournament? Registrations will close.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          try {
            await tournamentAPI.start(tournamentId);
            Alert.alert('Success', 'Tournament has started!');
            loadData();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to start tournament');
          }
        },
      },
    ]);
  };

  const openSubmitResult = (match) => {
    setSelectedMatch(match);
    setScore1('');
    setScore2('');
    setResultModalVisible(true);
  };

  const handleSubmitResult = async () => {
    if (score1 === '' || score2 === '') {
      Alert.alert('Error', 'Please enter both scores');
      return;
    }
    setSubmitLoading(true);
    try {
      await tournamentAPI.submitResult(tournamentId, selectedMatch.id, {
        score1: parseInt(score1),
        score2: parseInt(score2),
      });
      Alert.alert('Success', 'Result submitted!');
      setResultModalVisible(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to submit result');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState icon="404" title="Tournament not found" />
      </SafeAreaView>
    );
  }

  const tabs = getTabs();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'<'} Back</Text>
        </TouchableOpacity>

        {/* Header Info */}
        <View style={styles.detailHeader}>
          <Text style={styles.tournamentTitle}>{tournament.name}</Text>
          <View style={styles.badgeRow}>
            <Badge variant={getStatusBadgeVariant(tournament.status)}>{statusLabel}</Badge>
            <Badge variant="violet" style={{ marginLeft: Spacing.xs }}>
              {FORMAT_LABELS[tournament.format] || tournament.format}
            </Badge>
            <Badge variant="secondary" style={{ marginLeft: Spacing.xs }}>{tournament.sport}</Badge>
          </View>

          {tournament.description ? (
            <Text style={styles.description}>{tournament.description}</Text>
          ) : null}

          <Card style={styles.infoCard}>
            <View style={styles.infoGrid}>
              {[
                { label: 'Organizer', value: tournament.organizer_name || 'Unknown' },
                { label: 'Dates', value: `${tournament.start_date || '--'} to ${tournament.end_date || '--'}` },
                { label: 'Participants', value: `${participantCount}/${tournament.max_participants || '--'}` },
                { label: 'Entry Fee', value: tournament.entry_fee > 0 ? `\u20B9${tournament.entry_fee}` : 'Free' },
                { label: 'Prize Pool', value: tournament.prize_pool > 0 ? `\u20B9${tournament.prize_pool}` : '--' },
                { label: 'Venue', value: tournament.venue_name || '--' },
              ].map((item) => (
                <View key={item.label} style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {['registration_open', 'registration'].includes(tournament.status) && !isRegistered && !isOrganizer && (
              <Button onPress={handleRegister} style={{ flex: 1 }}>
                {tournament.entry_fee > 0 ? `Pay \u20B9${tournament.entry_fee} & Register` : 'Register'}
              </Button>
            )}
            {['registration_open', 'registration'].includes(tournament.status) && isRegistered && (
              <Button variant="destructive" onPress={handleWithdraw} style={{ flex: 1 }}>Withdraw</Button>
            )}
            {isOrganizer && ['registration_open', 'registration'].includes(tournament.status) && (
              <Button variant="secondary" onPress={handleStart} style={{ flex: 1 }}>Start Tournament</Button>
            )}
            {isRegistered && (
              <Badge variant="default" style={{ marginLeft: Spacing.sm }}>Registered</Badge>
            )}
          </View>
        </View>

        {/* Tab Bar */}
        {tabs.length > 0 && (
          <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        )}

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'bracket' && <BracketTab tournament={tournament} />}
          {activeTab === 'standings' && <StandingsTab tournamentId={tournamentId} />}
          {activeTab === 'matches' && (
            <MatchesTab
              tournament={tournament}
              isOrganizer={isOrganizer}
              onSubmitResult={openSubmitResult}
            />
          )}
          {activeTab === 'players' && <PlayersTab participants={tournament.participants} />}
          {activeTab === 'live' && (
            <View style={{ gap: Spacing.md }}>
              {/* Active live matches */}
              {liveMatches.length > 0 ? liveMatches.map(lm => (
                <TouchableOpacity key={lm.id} activeOpacity={0.75}
                  onPress={() => navigation.navigate('LiveScoring', { liveMatchId: lm.id, tournamentId, organizerId: tournament.organizer_id })}
                  style={styles.liveMatchCard}>
                  <View style={styles.liveMatchHeader}>
                    <Text style={styles.liveMatchLabel}>{lm.match_label}</Text>
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  </View>
                  <View style={styles.liveScoreRow}>
                    <Text style={styles.livePlayerName} numberOfLines={1}>{lm.home?.name}</Text>
                    <Text style={styles.liveScore}>{lm.home?.score} — {lm.away?.score}</Text>
                    <Text style={styles.livePlayerName} numberOfLines={1}>{lm.away?.name}</Text>
                  </View>
                  <View style={styles.liveMatchFooter}>
                    <Text style={styles.liveMetaText}>{lm.period_label}</Text>
                    <Text style={styles.liveMetaText}>👁 {lm.spectator_count || 0}</Text>
                  </View>
                </TouchableOpacity>
              )) : (
                <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
                  <Text style={{ fontSize: 32, marginBottom: Spacing.sm }}>📡</Text>
                  <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>No live matches right now</Text>
                </View>
              )}

              {/* Go Live buttons for organizer */}
              {isOrganizer && tournament.matches?.filter(m => m.status === 'pending' && m.player_a && m.player_b && !liveMatches.some(lm => lm.match_id === m.id)).length > 0 && (
                <View style={{ gap: Spacing.sm }}>
                  <Text style={{ color: Colors.mutedForeground, fontSize: 11, fontFamily: Typography.fontBodyBold, textTransform: 'uppercase', letterSpacing: 1 }}>Start Live Scoring</Text>
                  {tournament.matches.filter(m => m.status === 'pending' && m.player_a && m.player_b && !liveMatches.some(lm => lm.match_id === m.id)).map(m => {
                    const pA = tournament.participants?.find(p => p.user_id === m.player_a || p.id === m.player_a);
                    const pB = tournament.participants?.find(p => p.user_id === m.player_b || p.id === m.player_b);
                    return (
                      <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.foreground, fontSize: 14, fontFamily: Typography.fontBodyBold }}>{pA?.name || 'TBD'} vs {pB?.name || 'TBD'}</Text>
                          <Text style={{ color: Colors.mutedForeground, fontSize: 11 }}>Round {m.round} — Match #{m.match_number}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              const res = await liveAPI.start({ tournament_id: tournamentId, match_id: m.id });
                              navigation.navigate('LiveScoring', { liveMatchId: res.data.id, tournamentId, organizerId: tournament.organizer_id });
                            } catch (e) {
                              Alert.alert('Error', e?.response?.data?.detail || 'Failed to start live scoring');
                            }
                          }}
                          style={styles.goLiveBtn}>
                          <Text style={styles.goLiveBtnText}>🔴 Go Live</Text>
                        </TouchableOpacity>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submit Result Modal */}
      <ModalSheet
        visible={resultModalVisible}
        onClose={() => setResultModalVisible(false)}
        title="Submit Match Result"
      >
        {selectedMatch && (
          <>
            <View style={styles.resultPlayers}>
              <Text style={styles.resultPlayerName}>{selectedMatch.player1_name || 'Player 1'}</Text>
              <Text style={styles.resultVs}>vs</Text>
              <Text style={styles.resultPlayerName}>{selectedMatch.player2_name || 'Player 2'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Input
                  label={`${selectedMatch.player1_name || 'Player 1'} Score`}
                  value={score1}
                  onChangeText={setScore1}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label={`${selectedMatch.player2_name || 'Player 2'} Score`}
                  value={score2}
                  onChangeText={setScore2}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Button onPress={handleSubmitResult} loading={submitLoading} style={{ marginTop: Spacing.sm }}>
              Submit Result
            </Button>
          </>
        )}
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  backText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.primary,
  },
  detailHeader: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  tournamentTitle: {
    fontSize: Typography.xl3,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
    marginBottom: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  infoCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  infoItem: {
    width: '45%',
  },
  infoLabel: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tabContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl3,
  },
  // Bracket styles
  bracketScroll: {
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  bracketRound: {
    width: 200,
    marginRight: Spacing.md,
  },
  roundTitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bracketMatch: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  bracketSlot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bracketPlayer: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    flex: 1,
  },
  bracketScore: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
    marginLeft: Spacing.sm,
  },
  bracketDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  // Standings table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusMd,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tableHeaderCell: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Spacing.radiusSm,
  },
  tableCell: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.foreground,
  },
  // Match card
  matchCard: {
    padding: Spacing.md,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  matchTeam: {
    flex: 1,
    gap: 4,
  },
  matchPlayerName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  matchScore: {
    fontSize: Typography.xl,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.foreground,
  },
  matchVs: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
    marginHorizontal: Spacing.md,
    textTransform: 'uppercase',
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  // Player list
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  playerRating: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  playerIdx: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
  },
  // Result modal
  resultPlayers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusMd,
  },
  resultPlayerName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  resultVs: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
  },
  // Live match styles
  liveMatchCard: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    padding: Spacing.md,
  },
  liveMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  liveMatchLabel: {
    fontSize: Typography.xs,
    color: Colors.mutedForeground,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.rose,
  },
  liveBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontBodyBold,
    color: Colors.rose,
    letterSpacing: 1,
  },
  liveScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  livePlayerName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
    flex: 1,
  },
  liveScore: {
    fontSize: 28,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.primary,
    marginHorizontal: Spacing.md,
  },
  liveMatchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveMetaText: {
    fontSize: Typography.xs,
    color: Colors.mutedForeground,
  },
  goLiveBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  goLiveBtnText: {
    fontSize: 12,
    fontFamily: Typography.fontBodyBold,
    color: Colors.rose,
  },
});
