import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';

export default function Avatar({ uri, name = '', size = 40, showOnline, online, style }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const bgColors = ['#0fb872', '#8b5cf6', '#f59e0b', '#38bdf8', '#f04444', '#ec4899'];
  const colorIdx = name.length % bgColors.length;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColors[colorIdx] },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials || '?'}</Text>
        </View>
      )}
      {showOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              backgroundColor: online ? '#22c55e' : Colors.mutedForeground,
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              borderWidth: size * 0.06,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontFamily: Typography.fontDisplayBlack,
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderColor: Colors.card,
  },
});
