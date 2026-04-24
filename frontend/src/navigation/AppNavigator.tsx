import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../theme';
import { authApi, UserOut } from '../api/client';

import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PantryScreen from '../screens/PantryScreen';
import DailyCheckScreen from '../screens/DailyCheckScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  Dashboard: { active: 'grid', inactive: 'grid-outline' },
  Pantry: { active: 'file-tray-full', inactive: 'file-tray-full-outline' },
  Scan: { active: 'scan', inactive: 'scan-outline' },
  Leftovers: { active: 'restaurant', inactive: 'restaurant-outline' },
  Community: { active: 'people', inactive: 'people-outline' },
};

function MainTabs({ user, onLogout }: { user: UserOut; onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={focused ? ICONS[route.name].active : ICONS[route.name].inactive}
            size={size - 2}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard">
        {props => <DashboardScreen {...props} user={user} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen name="Pantry" component={PantryScreen} />
      <Tab.Screen name="Scan" component={PlaceholderScreen}
        options={{ tabBarLabel: 'Skanuj' }} />
      <Tab.Screen name="Leftovers" component={PlaceholderScreen}
        options={{ tabBarLabel: 'Resztki' }} />
      <Tab.Screen name="Community" component={PlaceholderScreen}
        options={{ tabBarLabel: 'Społeczność' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session from stored token
  useEffect(() => {
    authApi.loadMe().then(u => { setUser(u); setLoading(false); });
  }, []);

  const handleLogout = () => { authApi.logout(); setUser(null); };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryBg }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">
          {() => <MainTabs user={user} onLogout={handleLogout} />}
        </Stack.Screen>
        <Stack.Screen
          name="DailyCheck"
          component={DailyCheckScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
