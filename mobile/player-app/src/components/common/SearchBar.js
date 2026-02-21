import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

export default function SearchBar({ value, onChangeText, onSubmit, placeholder = 'Search...', style }) {
  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={Colors.mutedForeground}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearBtn}>
          <View style={styles.clearIcon}>
            <View style={[styles.clearLine, { transform: [{ rotate: '45deg' }] }]} />
            <View style={[styles.clearLine, { transform: [{ rotate: '-45deg' }] }]} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.foreground,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  clearIcon: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearLine: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: Colors.mutedForeground,
    borderRadius: 1,
  },
});
