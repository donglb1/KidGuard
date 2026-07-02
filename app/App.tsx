import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider, useStore } from '@/state/store';
import { configureNotifications } from '@/services/notifier';
import { colors } from '@/theme';
import OnboardingScreen from '@/screens/OnboardingScreen';
import HomeScreen from '@/screens/HomeScreen';
import ContactsScreen from '@/screens/ContactsScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import VehicleScreen from '@/screens/VehicleScreen';
import AlertOverlay from '@/screens/AlertOverlay';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}

function Main() {
  const { ready, data } = useStore();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!data.onboarded) {
    return <OnboardingScreen />;
  }

  return (
    <>
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textDim,
            tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          }}
        >
          <Tab.Screen
            name="Trang chủ"
            component={HomeScreen}
            options={{ tabBarIcon: ({ color }) => <TabIcon label="🏠" color={color} /> }}
          />
          <Tab.Screen
            name="Liên hệ"
            component={ContactsScreen}
            options={{ tabBarIcon: ({ color }) => <TabIcon label="📞" color={color} /> }}
          />
          <Tab.Screen
            name="Xe"
            component={VehicleScreen}
            options={{ tabBarIcon: ({ color }) => <TabIcon label="🚙" color={color} /> }}
          />
          <Tab.Screen
            name="Nhật ký"
            component={HistoryScreen}
            options={{ tabBarIcon: ({ color }) => <TabIcon label="📜" color={color} /> }}
          />
          <Tab.Screen
            name="Cài đặt"
            component={SettingsScreen}
            options={{ tabBarIcon: ({ color }) => <TabIcon label="⚙️" color={color} /> }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <AlertOverlay />
    </>
  );
}

export default function App() {
  // Cấu hình handler thông báo + chế độ âm thanh mỗi lần khởi động (không chỉ khi onboarding),
  // để người dùng đã onboard vẫn nhận báo động và phát chuông đúng cách.
  useEffect(() => {
    configureNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <StoreProvider>
        <Main />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
