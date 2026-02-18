import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Colors from '../../styles/colors';
import Typography from '../../styles/typography';
import Spacing from '../../styles/spacing';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [regData, setRegData] = useState({
    name: '', email: '', password: '', role: 'player', phone: ''
  });

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(loginData.email, loginData.password);
    } catch (err) {
      Alert.alert('Login Failed', err?.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regData.name || !regData.email || !regData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      await register(regData);
    } catch (err) {
      Alert.alert('Registration Failed', err?.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <Text style={styles.logoText}>HORIZON</Text>
            <Text style={styles.logoSubtitle}>Sports Facility Operating System</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, tab === 'login' && styles.tabActive]}
                onPress={() => setTab('login')}
              >
                <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
                  Log In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'register' && styles.tabActive]}
                onPress={() => setTab('register')}
              >
                <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {tab === 'login' ? (
              <View>
                <Input
                  label="Email"
                  value={loginData.email}
                  onChangeText={v => setLoginData(p => ({ ...p, email: v }))}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  style={{ marginBottom: Spacing.md }}
                />
                <Input
                  label="Password"
                  value={loginData.password}
                  onChangeText={v => setLoginData(p => ({ ...p, password: v }))}
                  placeholder="Enter password"
                  secureTextEntry
                  style={{ marginBottom: Spacing.lg }}
                />
                <Button onPress={handleLogin} loading={loading} size="lg">
                  Sign In
                </Button>
                <Text style={styles.demoText}>
                  Demo: demo@player.com{'\n'}Password: demo123
                </Text>
              </View>
            ) : (
              <View>
                <Input
                  label="Full Name"
                  value={regData.name}
                  onChangeText={v => setRegData(p => ({ ...p, name: v }))}
                  placeholder="Your name"
                  autoCapitalize="words"
                  style={{ marginBottom: Spacing.md }}
                />
                <Input
                  label="Email"
                  value={regData.email}
                  onChangeText={v => setRegData(p => ({ ...p, email: v }))}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  style={{ marginBottom: Spacing.md }}
                />
                <Input
                  label="Password"
                  value={regData.password}
                  onChangeText={v => setRegData(p => ({ ...p, password: v }))}
                  placeholder="Min 6 characters"
                  secureTextEntry
                  style={{ marginBottom: Spacing.md }}
                />
                <Input
                  label="Phone (optional)"
                  value={regData.phone}
                  onChangeText={v => setRegData(p => ({ ...p, phone: v }))}
                  placeholder="+91 98765 43210"
                  keyboardType="phone-pad"
                  style={{ marginBottom: Spacing.md }}
                />

                {/* Role Selection */}
                <Text style={styles.label}>I am a</Text>
                <View style={styles.roleRow}>
                  {['player', 'venue_owner', 'coach'].map(role => (
                    <TouchableOpacity
                      key={role}
                      style={[styles.roleBtn, regData.role === role && styles.roleBtnActive]}
                      onPress={() => setRegData(p => ({ ...p, role }))}
                    >
                      <Text style={[styles.roleBtnText, regData.role === role && styles.roleBtnTextActive]}>
                        {role === 'venue_owner' ? 'Owner' : role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ marginTop: Spacing.lg }}>
                  <Button onPress={handleRegister} loading={loading} size="lg">
                    Create Account
                  </Button>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xl2,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: Spacing.xl2,
  },
  logoText: {
    fontSize: Typography.xl5,
    fontFamily: Typography.fontDisplayBlack,
    color: Colors.primary,
    letterSpacing: -1,
  },
  logoSubtitle: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.secondary,
    borderRadius: Spacing.radiusMd,
    padding: 3,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Spacing.radiusSm,
  },
  tabActive: {
    backgroundColor: Colors.card,
  },
  tabText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
  },
  tabTextActive: {
    color: Colors.foreground,
  },
  demoText: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  label: {
    fontSize: Typography.xs,
    fontFamily: Typography.fontBody,
    color: Colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Spacing.radiusMd,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.secondary,
  },
  roleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  roleBtnText: {
    fontSize: Typography.sm,
    fontFamily: Typography.fontBodyBold,
    color: Colors.mutedForeground,
  },
  roleBtnTextActive: {
    color: Colors.primary,
  },
});
