import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
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

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
