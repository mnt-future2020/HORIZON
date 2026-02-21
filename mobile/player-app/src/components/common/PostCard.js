import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import Badge from './Badge';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

const REACTIONS = ['🔥', '🏆', '👏', '❤️', '💯', '💪'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function PostCard({
  post,
  onLike,
  onReact,
  onComment,
  onBookmark,
  onDelete,
  onUserPress,
  currentUserId,
  style,
}) {
  const [showReactions, setShowReactions] = useState(false);
  const isOwn = currentUserId === post.user_id;

  return (
    <View style={[styles.card, style]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => onUserPress?.(post.user_id)}>
          <Avatar uri={post.user_avatar} name={post.user_name} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{post.user_name}</Text>
            <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
          </View>
        </TouchableOpacity>
        {post.post_type && post.post_type !== 'text' && (
          <Badge variant="secondary">{post.post_type.replace('_', ' ')}</Badge>
        )}
        {isOwn && onDelete && (
          <TouchableOpacity onPress={() => onDelete(post.id)} style={styles.deleteBtn}>
            <Text style={{ color: Colors.destructive, fontSize: 12 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {post.content ? <Text style={styles.content}>{post.content}</Text> : null}

      {/* Media */}
      {post.media_url ? (
        <Image source={{ uri: post.media_url }} style={styles.media} resizeMode="cover" />
      ) : null}

      {/* Reactions display */}
      {post.reactions && Object.keys(post.reactions).length > 0 && (
        <View style={styles.reactionsRow}>
          {Object.entries(post.reactions)
            .filter(([, count]) => count > 0)
            .slice(0, 4)
            .map(([emoji, count]) => (
              <View key={emoji} style={styles.reactionBadge}>
                <Text style={{ fontSize: 12 }}>{emoji}</Text>
                <Text style={styles.reactionCount}>{count}</Text>
              </View>
            ))}
        </View>
      )}

      {/* Action bar */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onLike?.(post.id)}
        >
          <Text style={{ fontSize: 16 }}>{post.user_liked ? '❤️' : '🤍'}</Text>
          <Text style={styles.actionCount}>{post.likes_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment?.(post.id)}>
          <Text style={{ fontSize: 14 }}>💬</Text>
          <Text style={styles.actionCount}>{post.comments_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowReactions(!showReactions)}>
          <Text style={{ fontSize: 14 }}>🔥</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.actionBtn} onPress={() => onBookmark?.(post.id)}>
          <Text style={{ fontSize: 14 }}>{post.user_bookmarked ? '🔖' : '📑'}</Text>
        </TouchableOpacity>
      </View>

      {/* Reaction picker */}
      {showReactions && (
        <View style={styles.reactionPicker}>
          {REACTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={styles.reactionPickerItem}
              onPress={() => {
                onReact?.(post.id, r);
                setShowReactions(false);
              }}
            >
              <Text style={{ fontSize: 22 }}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  userName: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  time: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  deleteBtn: {
    padding: Spacing.xs,
  },
  content: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.foreground,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    lineHeight: 20,
  },
  media: {
    width: '100%',
    height: 220,
  },
  reactionsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusFull,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    gap: 3,
  },
  reactionCount: {
    fontSize: 10,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  reactionPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondary,
    gap: Spacing.md,
  },
  reactionPickerItem: {
    padding: Spacing.xs,
  },
});
