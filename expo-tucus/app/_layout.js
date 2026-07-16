import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PlayerProvider } from '../services/playerContext';

export default function Layout() {
  return (
    <PlayerProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: '#0f0f1a' },
          headerTintColor: '#fff',
          tabBarStyle: { backgroundColor: '#0f0f1a', borderTopColor: '#222' },
          tabBarActiveTintColor: '#a855f7',
          tabBarInactiveTintColor: '#666',
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: () => null }} />
        <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: () => null }} />
        <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: () => null }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: () => null }} />
        <Tabs.Screen name="now-playing" options={{ href: null }} />
      </Tabs>
    </PlayerProvider>
  );
}
