import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

export default function UserRow({ user, subtitle, rightComponent, onPress, style }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.75 } : {};
  return (
    <Wrapper {...wrapperProps} style={[styles.row, style]}>
      <Avatar uri={user.avatar} name={user.name || ''} size={40} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{user.name || 'Unknown'}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {rightComponent ? <View style={styles.right}>{rightComponent}</View> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.foreground,
  },
  subtitle: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
  },
  right: {
    flexShrink: 0,
  },
});
