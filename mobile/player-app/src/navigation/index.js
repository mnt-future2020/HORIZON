import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';

// Existing screens
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

// Player screens
import SocialFeedScreen from '../screens/player/SocialFeedScreen';
import ExploreScreen from '../screens/player/ExploreScreen';
import ChatScreen from '../screens/player/ChatScreen';
import CommunitiesScreen from '../screens/player/CommunitiesScreen';
import GroupDetailScreen from '../screens/player/GroupDetailScreen';
import TeamsScreen from '../screens/player/TeamsScreen';
import TournamentsScreen from '../screens/player/TournamentsScreen';
import TournamentDetailScreen from '../screens/player/TournamentDetailScreen';
import CoachListingScreen from '../screens/player/CoachListingScreen';
import PlayerCardScreen from '../screens/player/PlayerCardScreen';
import ContactSyncScreen from '../screens/player/ContactSyncScreen';
import BookmarksScreen from '../screens/player/BookmarksScreen';
import NotificationsScreen from '../screens/player/NotificationsScreen';
import PrivacySettingsScreen from '../screens/player/PrivacySettingsScreen';
import SubscriptionScreen from '../screens/player/SubscriptionScreen';

// Owner screens
import VenueOwnerDashboardScreen from '../screens/owner/VenueOwnerDashboardScreen';
import POSScreen from '../screens/owner/POSScreen';
import IoTDashboardScreen from '../screens/owner/IoTDashboardScreen';

// Coach screens
import CoachDashboardScreen from '../screens/coach/CoachDashboardScreen';
import OrganizationScreen from '../screens/coach/OrganizationScreen';
import PerformanceRecordsScreen from '../screens/coach/PerformanceRecordsScreen';
import TrainingLogScreen from '../screens/coach/TrainingLogScreen';
import LiveScoringScreen from '../screens/player/LiveScoringScreen';

// Admin screens
import AdminScreen from '../screens/admin/AdminScreen';

import Colors from '../styles/colors';
import Typography from '../styles/typography';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabScreenOptions = {
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
};

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: focused ? 20 : 18, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

// Venues nested stack
const VenuesStackNav = createNativeStackNavigator();
function VenuesStack() {
  return (
    <VenuesStackNav.Navigator screenOptions={{ headerShown: false }}>
      <VenuesStackNav.Screen name="VenueList" component={VenuesScreen} />
      <VenuesStackNav.Screen name="VenueDetailNested" component={VenueDetailScreen} />
    </VenuesStackNav.Navigator>
  );
}

// ── Player Tabs ─────────────────────────────────────────
function PlayerTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Feed" component={SocialFeedScreen}
        options={{ tabBarLabel: 'Feed', tabBarIcon: ({ focused }) => <TabIcon emoji="📱" focused={focused} /> }} />
      <Tab.Screen name="Explore" component={ExploreScreen}
        options={{ tabBarLabel: 'Explore', tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} /> }} />
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tab.Screen name="Chat" component={ChatScreen}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ── Venue Owner Tabs ────────────────────────────────────
function OwnerTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Feed" component={SocialFeedScreen}
        options={{ tabBarLabel: 'Feed', tabBarIcon: ({ focused }) => <TabIcon emoji="📱" focused={focused} /> }} />
      <Tab.Screen name="Dashboard" component={VenueOwnerDashboardScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
      <Tab.Screen name="POS" component={POSScreen}
        options={{ tabBarLabel: 'POS', tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} /> }} />
      <Tab.Screen name="IoT" component={IoTDashboardScreen}
        options={{ tabBarLabel: 'IoT', tabBarIcon: ({ focused }) => <TabIcon emoji="💡" focused={focused} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ── Coach Tabs ──────────────────────────────────────────
function CoachTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Feed" component={SocialFeedScreen}
        options={{ tabBarLabel: 'Feed', tabBarIcon: ({ focused }) => <TabIcon emoji="📱" focused={focused} /> }} />
      <Tab.Screen name="Dashboard" component={CoachDashboardScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon emoji="🎓" focused={focused} /> }} />
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tab.Screen name="Chat" component={ChatScreen}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ── Admin Tabs ──────────────────────────────────────────
function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Admin" component={AdminScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon emoji="🛡️" focused={focused} /> }} />
      <Tab.Screen name="Feed" component={SocialFeedScreen}
        options={{ tabBarLabel: 'Feed', tabBarIcon: ({ focused }) => <TabIcon emoji="📱" focused={focused} /> }} />
      <Tab.Screen name="Chat" component={ChatScreen}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ── Role-based tab selector ─────────────────────────────
function RoleBasedTabs() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'venue_owner': return <OwnerTabs />;
    case 'coach': return <CoachTabs />;
    case 'super_admin': return <AdminTabs />;
    default: return <PlayerTabs />;
  }
}

const modalScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: Colors.card },
  headerTintColor: Colors.foreground,
  headerTitleStyle: { fontFamily: Typography.fontDisplayBlack, fontSize: 16 },
};

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
          <>
            <Stack.Screen name="Main" component={RoleBasedTabs} />

            {/* Shared stack screens accessible from any role */}
            <Stack.Screen name="Highlights" component={HighlightsScreen} options={{ ...modalScreenOptions, title: 'Highlights' }} />
            <Stack.Screen name="RatingProfile" component={RatingProfileScreen} options={{ ...modalScreenOptions, title: 'Rating Profile' }} />
            <Stack.Screen name="SplitPayment" component={SplitPaymentScreen} options={{ ...modalScreenOptions, title: 'Split Payment' }} />
            <Stack.Screen name="VenueDetail" component={VenueDetailScreen} options={{ ...modalScreenOptions, title: 'Venue' }} />
            <Stack.Screen name="PlayerCard" component={PlayerCardScreen} options={{ ...modalScreenOptions, title: 'Player Card' }} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ ...modalScreenOptions, title: 'Group' }} />
            <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} options={{ ...modalScreenOptions, title: 'Tournament' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ ...modalScreenOptions, title: 'Notifications' }} />
            <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ ...modalScreenOptions, title: 'Bookmarks' }} />
            <Stack.Screen name="ContactSync" component={ContactSyncScreen} options={{ ...modalScreenOptions, title: 'Contacts' }} />
            <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} options={{ ...modalScreenOptions, title: 'Privacy & Data' }} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ ...modalScreenOptions, title: 'Subscription' }} />
            <Stack.Screen name="CoachListing" component={CoachListingScreen} options={{ ...modalScreenOptions, title: 'Find Coach' }} />
            <Stack.Screen name="Communities" component={CommunitiesScreen} options={{ ...modalScreenOptions, title: 'Communities' }} />
            <Stack.Screen name="Teams" component={TeamsScreen} options={{ ...modalScreenOptions, title: 'Teams' }} />
            <Stack.Screen name="Tournaments" component={TournamentsScreen} options={{ ...modalScreenOptions, title: 'Tournaments' }} />
            <Stack.Screen name="Venues" component={VenuesStack} options={{ ...modalScreenOptions, headerShown: false }} />
            <Stack.Screen name="Matchmaking" component={MatchmakingScreen} options={{ ...modalScreenOptions, title: 'Matchmaking' }} />
            <Stack.Screen name="Bookings" component={BookingsScreen} options={{ ...modalScreenOptions, title: 'Bookings' }} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ ...modalScreenOptions, title: 'Leaderboard' }} />
            <Stack.Screen name="Organizations" component={OrganizationScreen} options={{ ...modalScreenOptions, title: 'Organizations' }} />
            <Stack.Screen name="PerformanceRecords" component={PerformanceRecordsScreen} options={{ ...modalScreenOptions, title: 'Records' }} />
            <Stack.Screen name="TrainingLogs" component={TrainingLogScreen} options={{ ...modalScreenOptions, title: 'Training' }} />
            <Stack.Screen name="LiveScoring" component={LiveScoringScreen} options={{ ...modalScreenOptions, title: 'Live Score' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
