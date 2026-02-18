import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal, Share, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { highlightAPI } from '../api';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

const SIGNIFICANCE_COLORS = {
  goal: Colors.amber,
  save: Colors.sky,
  rally: Colors.violet,
  foul: Colors.destructive,
  celebration: Colors.primary,
  turning_point: Colors.orange,
  skill_move: Colors.cyan,
  other: Colors.mutedForeground,
};

const SIGNIFICANCE_ICONS = {
  goal: '🏆', save: '🛡️', rally: '⚡', foul: '🚩',
  celebration: '🎉', turning_point: '🔄', skill_move: '✨', other: '📌',
};

function StatusBadge({ status }) {
  const map = {
    uploaded: { variant: 'sky', label: 'Ready' },
    analyzing: { variant: 'amber', label: 'Analyzing...' },
    completed: { variant: 'default', label: 'Complete ✓' },
    failed: { variant: 'destructive', label: 'Failed' },
  };
  const s = map[status] || map.uploaded;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function HighlightCard({ highlight, onAnalyze, onShare, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try { await onAnalyze(highlight.id); }
    finally { setAnalyzing(false); }
  };

  return (
    <Card style={styles.hlCard}>
      <View style={styles.hlHeader}>
        <View style={styles.hlIconBox}>
          <Text style={{ fontSize: 22 }}>🎬</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hlTitle} numberOfLines={1}>{highlight.title}</Text>
          <View style={styles.hlMetaRow}>
            <StatusBadge status={highlight.status} />
            {highlight.duration && <Text style={styles.hlMeta}>⏱ {Math.round(highlight.duration)}s</Text>}
            {highlight.moments?.length > 0 && (
              <Text style={styles.hlMeta}>🎯 {highlight.moments.length} moments</Text>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => onDelete(highlight.id)} style={{ padding: 4 }}>
          <Text style={{ fontSize: 16, color: Colors.mutedForeground }}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.hlActions}>
        {highlight.status === 'uploaded' && (
          <Button size="sm" onPress={handleAnalyze} loading={analyzing} style={{ flex: 1 }}>
            ✨ Analyze with AI
          </Button>
        )}
        {highlight.status === 'analyzing' && (
          <View style={styles.analyzingBox}>
            <ActivityIndicator size="small" color={Colors.amber} style={{ marginRight: 8 }} />
            <Text style={{ color: Colors.amber, fontSize: Typography.xs, fontFamily: Typography.fontBodyBold }}>
              Gemini AI is analyzing...
            </Text>
          </View>
        )}
        {highlight.status === 'completed' && (
          <>
            <Button size="sm" variant="secondary" onPress={() => setExpanded(!expanded)} style={{ flex: 1 }}>
              {expanded ? 'Hide Moments' : '👁 View Moments'}
            </Button>
            <Button size="sm" onPress={() => onShare(highlight.id)} style={{ marginLeft: Spacing.sm }}>
              🔗 Share
            </Button>
          </>
        )}
        {highlight.status === 'failed' && (
          <Button size="sm" variant="destructive" onPress={handleAnalyze} loading={analyzing} style={{ flex: 1 }}>
            Retry Analysis
          </Button>
        )}
      </View>

      {/* Moments list */}
      {expanded && highlight.moments?.length > 0 && (
        <View style={styles.momentsContainer}>
          <Text style={styles.momentsTitle}>🎯 Key Moments</Text>
          {highlight.moments.map((m, i) => {
            const color = SIGNIFICANCE_COLORS[m.significance] || Colors.mutedForeground;
            const icon = SIGNIFICANCE_ICONS[m.significance] || '📌';
            return (
              <View key={i} style={styles.momentRow}>
                <View style={[styles.momentTimeBadge, { backgroundColor: `${color}20` }]}>
                  <Text style={[styles.momentTime, { color }]}>
                    {Math.floor(m.timestamp / 60)}:{String(Math.floor(m.timestamp % 60)).padStart(2, '0')}
                  </Text>
                </View>
                <View style={styles.momentContent}>
                  <View style={styles.momentTagRow}>
                    <Text style={{ fontSize: 12 }}>{icon}</Text>
                    <Text style={[styles.momentTag, { color }]}>{m.significance?.replace('_', ' ')}</Text>
                    {m.confidence != null && (
                      <Text style={styles.momentConf}>{Math.round(m.confidence * 100)}% confident</Text>
                    )}
                  </View>
                  <Text style={styles.momentDesc}>{m.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function UploadModal({ visible, onClose, onUploaded }) {
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Gallery access required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled) {
      setSelectedFile(result.assets[0]);
      if (!title) setTitle('Match Recording');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) { Alert.alert('Select a video first'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri: selectedFile.uri, type: 'video/mp4', name: 'match.mp4' });
      formData.append('title', title || 'Match Recording');
      await highlightAPI.upload(formData);
      Alert.alert('Uploaded!', 'Your video is ready. Click "Analyze with AI" to generate highlights.');
      onUploaded();
      onClose();
      setSelectedFile(null);
      setTitle('');
    } catch (err) {
      Alert.alert('Upload Failed', err?.response?.data?.detail || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Match Video</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: Colors.mutedForeground, fontSize: 20 }}>✕</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.dropZone, selectedFile && styles.dropZoneSelected]} onPress={pickVideo}>
            {selectedFile ? (
              <>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎬</Text>
                <Text style={styles.dropZoneText}>{selectedFile.uri.split('/').pop()}</Text>
                <Text style={styles.dropZoneHint}>Tap to change</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 40, marginBottom: Spacing.md }}>📹</Text>
                <Text style={styles.dropZoneText}>Tap to select video</Text>
                <Text style={styles.dropZoneHint}>MP4, MOV — from Gallery</Text>
              </>
            )}
          </TouchableOpacity>

          <Input
            label="Match Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Weekend Football Match"
            style={{ marginTop: Spacing.md }}
            autoCapitalize="sentences"
          />

          <Button onPress={handleUpload} loading={uploading} style={{ marginTop: Spacing.sm }} disabled={!selectedFile}>
            Upload Video
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default function HighlightsScreen() {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);

  const loadHighlights = async () => {
    try {
      const res = await highlightAPI.list();
      setHighlights(res.data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadHighlights(); }, []);

  const onRefresh = () => { setRefreshing(true); loadHighlights(); };

  const handleAnalyze = async (id) => {
    try {
      await highlightAPI.analyze(id);
      loadHighlights();
      Alert.alert('Analysis Started', 'Gemini AI is processing your video. This may take a moment.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to start analysis');
    }
  };

  const handleShare = async (id) => {
    try {
      const res = await highlightAPI.share(id);
      const shareUrl = res.data?.share_url || res.data?.share_link;
      if (shareUrl) {
        await Share.share({ message: `Check out my match highlights! ${shareUrl}`, url: shareUrl });
      }
      loadHighlights();
    } catch (err) {
      Alert.alert('Error', 'Failed to create share link');
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Highlight', 'Are you sure you want to delete this?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await highlightAPI.delete(id); loadHighlights(); }
          catch { Alert.alert('Error', 'Failed to delete'); }
        }
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>AI-POWERED</Text>
          <Text style={styles.headerTitle}>Highlights</Text>
        </View>
        <Button size="sm" onPress={() => setUploadVisible(true)}>+ Upload</Button>
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {highlights.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 56, marginBottom: Spacing.md }}>🎬</Text>
              <Text style={styles.emptyTitle}>No highlights yet</Text>
              <Text style={styles.emptySubText}>Upload a match video and let AI find the best moments</Text>
              <Button onPress={() => setUploadVisible(true)} style={{ marginTop: Spacing.lg }}>Upload Your First Video</Button>
            </View>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {highlights.map(h => (
                <HighlightCard key={h.id} highlight={h} onAnalyze={handleAnalyze} onShare={handleShare} onDelete={handleDelete} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <UploadModal visible={uploadVisible} onClose={() => setUploadVisible(false)} onUploaded={loadHighlights} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.md },
  headerSub: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textTransform: 'uppercase', letterSpacing: Typography.widest },
  headerTitle: { fontSize: Typography.xl3, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl3 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  emptySubText: { fontSize: Typography.sm, fontFamily: Typography.fontBody, color: Colors.mutedForeground, textAlign: 'center', marginTop: Spacing.sm },
  hlCard: { padding: Spacing.md },
  hlHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  hlIconBox: { width: 48, height: 48, backgroundColor: Colors.primaryLight, borderRadius: Spacing.radiusMd, justifyContent: 'center', alignItems: 'center' },
  hlTitle: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, flex: 1 },
  hlMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  hlMeta: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  hlActions: { flexDirection: 'row', alignItems: 'center' },
  analyzingBox: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: Spacing.sm },
  momentsContainer: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  momentsTitle: { fontSize: Typography.sm, fontFamily: Typography.fontBodyBold, color: Colors.foreground, marginBottom: Spacing.sm },
  momentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, alignItems: 'flex-start' },
  momentTimeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Spacing.radiusSm, minWidth: 48, alignItems: 'center' },
  momentTime: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold },
  momentContent: { flex: 1 },
  momentTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  momentTag: { fontSize: Typography.xs, fontFamily: Typography.fontBodyBold, textTransform: 'capitalize' },
  momentConf: { fontSize: 9, fontFamily: Typography.fontBody, color: Colors.mutedForeground },
  momentDesc: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.card, borderTopLeftRadius: Spacing.radius2xl, borderTopRightRadius: Spacing.radius2xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { fontSize: Typography.xl, fontFamily: Typography.fontDisplayBlack, color: Colors.foreground },
  dropZone: { borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: Spacing.radiusLg, padding: Spacing.xl2, alignItems: 'center', backgroundColor: Colors.secondary },
  dropZoneSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  dropZoneText: { fontSize: Typography.base, fontFamily: Typography.fontBodyBold, color: Colors.foreground, textAlign: 'center' },
  dropZoneHint: { fontSize: Typography.xs, fontFamily: Typography.fontBody, color: Colors.mutedForeground, marginTop: 4 },
});
