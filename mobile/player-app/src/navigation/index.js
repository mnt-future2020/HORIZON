import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';

// Screens
import AuthScreen from '../screens/auth/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import VenuesScreen from '../screens/VenuesScreen';
import VenueDetailScreen from '../screens/VenueDetailScreen';
import BookingsScreen from '../screens/BookingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import MatchmakingScreen from '../screens/MatchmakingScreen';
import HighlightsScreen from '../screens/HighlightsScreen';
import RatingProfileScreen from '../screens/RatingProfileScreen';
import SplitPaymentScreen from '../screens/SplitPaymentScreen';
import LoadingScreen from '../components/common/LoadingScreen';

import Colors from '../styles/colors';
import Typography from '../styles/typography';
import Spacing from '../styles/spacing';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: focused ? 20 : 18, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Typography.fontBodyBold,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Venues"
        component={VenuesStack}
        options={{
          tabBarLabel: 'Venues',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏟️" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{
          tabBarLabel: 'Bookings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: 'Rankings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Venues nested stack for VenueDetail
const VenuesStackNav = createNativeStackNavigator();
function VenuesStack() {
  return (
    <VenuesStackNav.Navigator screenOptions={{ headerShown: false }}>
      <VenuesStackNav.Screen name="VenueList" component={VenuesScreen} />
      <VenuesStackNav.Screen name="VenueDetail" component={VenueDetailScreen} />
    </VenuesStackNav.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: Colors.primary,
          background: Colors.background,
          card: Colors.card,
          text: Colors.foreground,
          border: Colors.border,
          notification: Colors.primary,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
