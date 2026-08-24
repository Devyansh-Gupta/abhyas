import { useEffect, useState } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { configurePersistence, hydrate } from '../src/store';
import { createSqliteAdapter } from '../src/repo/sqlite';
import { startAuthListener } from '../src/lib/auth';
import '../global.css';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0E1116',
    card: '#151B23',
    primary: '#8B7CF6',
    text: '#E7EBF2',
    border: '#1C232D',
  },
};

/**
 * #8 slice 1: wire SQLite persistence and hydrate before rendering tabs.
 * Renders nothing until hydration settles so a slow disk read never flashes
 * an empty state over restored data. The adapter itself resolves load() to null
 * on failure (F21/F24 — logged, never silent), so `ready` always flips true and
 * first launch / corrupted DB boots with empty state instead of hanging here.
 */
function useStartupHydration(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    configurePersistence(createSqliteAdapter());
    // P2: mirror supabase auth state into the app-wide useAuth slice.
    startAuthListener();
    hydrate()
      .catch(err => console.error('[startup] hydrate failed:', err))
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}

export default function RootLayout() {
  const ready = useStartupHydration();
  // Cycle-1 L2: brand font — block first paint until Inter is loaded so no
  // screen flashes in the system face and swaps underneath (same pattern as
  // the hydration gate below: render nothing until startup settles).
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  if (!ready || !fontsLoaded) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
