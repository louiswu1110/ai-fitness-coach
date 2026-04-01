import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BodyScreen from './src/screens/BodyScreen';
import DietScreen from './src/screens/DietScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import AICoachScreen from './src/screens/AICoachScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DrawerMenu from './src/components/DrawerMenu';
import { getStoredUser, getAccessTokenSync, logout as authLogout, UserInfo } from './src/services/auth';
import { initDatabase } from './src/services/database';
import { geminiService } from './src/services/gemini';
import { Colors } from './src/utils/theme';

const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

const LightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const DarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

export default function App() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  const handleLogout = () => {
    setDrawerOpen(false);
    setShowSettings(false);
    authLogout();
  };

  const handleOpenDrawer = () => setDrawerOpen(true);

  const loadUser = async () => {
    const u = await getStoredUser();
    setUser(u);
  };

  useEffect(() => {
    async function init() {
      try {
        await initDatabase();
        const storedUser = await getStoredUser();
        const token = getAccessTokenSync();
        if (token) geminiService.setAccessToken(token);
        setUser(storedUser);
        setIsLoggedIn(storedUser !== null);
      } catch {
        setIsLoggedIn(false);
      }
    }
    init();
  }, []);

  const navigateToTab = (tab: string) => {
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate(tab);
    }
  };

  // Loading state
  if (isLoggedIn === null) {
    return (
      <SafeAreaProvider>
        <View style={[loadingStyles.container, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoginScreen
          onLogin={() => {
            loadUser();
            setIsLoggedIn(true);
          }}
          onSkip={() => setIsLoggedIn(true)}
        />
      </SafeAreaProvider>
    );
  }

  // Main app
  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={isDark ? DarkNavTheme : LightNavTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap;
              switch (route.name) {
                case '總覽': iconName = focused ? 'home' : 'home-outline'; break;
                case '身體': iconName = focused ? 'body' : 'body-outline'; break;
                case '飲食': iconName = focused ? 'restaurant' : 'restaurant-outline'; break;
                case '訓練': iconName = focused ? 'barbell' : 'barbell-outline'; break;
                case '教練': iconName = focused ? 'sparkles' : 'sparkles-outline'; break;
                default: iconName = 'help-outline';
              }
              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textHint,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 65,
              paddingBottom: 8,
              paddingTop: 4,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            headerStyle: { backgroundColor: colors.background, elevation: 0, shadowOpacity: 0 },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700', fontSize: 18 },
            headerRight: () =>
              route.name !== '總覽' ? (
                <Pressable onPress={handleOpenDrawer} style={{ marginRight: 16 }}>
                  <Ionicons name="menu" size={24} color={colors.text} />
                </Pressable>
              ) : null,
          })}
        >
          <Tab.Screen name="總覽" options={{ headerShown: false }}>
            {() => <DashboardScreen onLogout={handleLogout} onOpenDrawer={handleOpenDrawer} />}
          </Tab.Screen>
          <Tab.Screen name="身體" component={BodyScreen} />
          <Tab.Screen name="飲食" component={DietScreen} />
          <Tab.Screen name="訓練" component={TrainingScreen} />
          <Tab.Screen name="教練" component={AICoachScreen} />
        </Tab.Navigator>
      </NavigationContainer>

      {/* Drawer overlay - rendered above NavigationContainer */}
      <DrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={navigateToTab}
        onSettings={() => setShowSettings(true)}
        onLogout={handleLogout}
        userName={user?.name}
        userEmail={user?.email}
        userPicture={user?.picture}
      />

      {/* Settings overlay */}
      {showSettings && (
        <View style={StyleSheet.absoluteFill}>
          <SettingsScreen
            onClose={() => {
              setShowSettings(false);
              loadUser(); // Refresh user info after settings change
            }}
            onLogout={handleLogout}
          />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
