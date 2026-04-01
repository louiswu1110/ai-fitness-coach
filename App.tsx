import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import DashboardScreen from './src/screens/DashboardScreen';
import BodyScreen from './src/screens/BodyScreen';
import DietScreen from './src/screens/DietScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import AICoachScreen from './src/screens/AICoachScreen';
import { Colors } from './src/utils/theme';

const Tab = createBottomTabNavigator();

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

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={isDark ? DarkNavTheme : LightNavTheme}>
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
          })}
        >
          <Tab.Screen name="總覽" component={DashboardScreen} options={{ headerShown: false }} />
          <Tab.Screen name="身體" component={BodyScreen} />
          <Tab.Screen name="飲食" component={DietScreen} />
          <Tab.Screen name="訓練" component={TrainingScreen} />
          <Tab.Screen name="教練" component={AICoachScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
