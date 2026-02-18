import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  style,
  error,
  leftIcon,
  rightIcon,
  ...props
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      <View style={[styles.inputWrapper, focused && styles.inputFocused, error && styles.inputError]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.mutedForeground}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, leftIcon && { paddingLeft: 40 }, rightIcon && { paddingRight: 40 }]}
          {...props}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: Typography.wider,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    backgroundColor: Colors.background,
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
  inputError: {
    borderColor: Colors.destructive,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    color: Colors.foreground,
    fontSize: Typography.base,
    fontFamily: Typography.fontBody,
  },
  iconLeft: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  iconRight: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
  },
  error: {
    fontSize: Typography.xs,
    color: Colors.destructive,
    marginTop: 4,
    fontFamily: Typography.fontBody,
  },
});
