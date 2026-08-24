/**
 * /auth — P2 sign-in screen (expo-router).
 * Two flows: native Google (ID-token exchange) and email OTP (code → verify).
 * Every failure renders visibly in the red banner (F21/F24 — no silent failures).
 * Typecheck-verified only per the P2 slice brief; device runs need the Google
 * Cloud Console setup documented in docs/P2-AUTH-SETUP.md.
 */
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import {
  signInWithEmailOtp,
  signInWithGoogle,
  signOut,
  useAuth,
  verifyEmailOtp,
} from '../src/lib/auth';

export default function AuthScreen() {
  const userId = useAuth(s => s.userId);
  const email = useAuth(s => s.email);
  const status = useAuth(s => s.status);
  const error = useAuth(s => s.error);
  const otpSent = useAuth(s => s.otpSent);
  const clearError = useAuth(s => s.clearError);

  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');

  useEffect(() => {
    // Reset any stale error when arriving at the screen.
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = status === 'signing-in';

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-16" keyboardShouldPersistTaps="handled">
      <Text className="text-text text-3xl font-extrabold tracking-tight">Sign in</Text>
      <Text className="mt-1 text-[13px] text-dim">
        Sync your plan across devices · offline-first, always works without it.
      </Text>

      {/* visible error state (F21/F24) */}
      {error && (
        <View
          accessibilityLabel="Sign-in error"
          className="mt-5 rounded-2xl border border-due/40 bg-due/10 p-3"
        >
          <Text className="text-sm font-bold text-due">{error}</Text>
        </View>
      )}

      {userId ? (
        <View className="mt-6 rounded-3xl border border-line bg-surface p-4">
          <Text className="font-extrabold" style={{ color: '#E7EBF2' }}>
            ✅ Signed in
          </Text>
          <Text className="mt-1 text-xs text-dim" selectable>
            {email ?? `user ${userId}`}
          </Text>
          <Pressable
            accessibilityLabel="Sign out"
            disabled={busy}
            className="mt-4 items-center rounded-2xl border border-line bg-surface-2 py-3 active:bg-accent/30"
            onPress={() => void signOut()}
          >
            <Text className="text-sm font-extrabold" style={{ color: '#C9BFFF' }}>
              Sign out
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Back to app"
            className="mt-3 items-center py-1"
            onPress={() => router.back()}
          >
            <Text className="text-xs font-bold text-dim">← Back to app</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Google native */}
          <Pressable
            accessibilityLabel="Sign in with Google"
            disabled={busy}
            className="mt-6 items-center rounded-2xl border border-line bg-surface py-4 active:bg-accent/30"
            onPress={() => void signInWithGoogle()}
          >
            <Text className="text-sm font-extrabold" style={{ color: '#E7EBF2' }}>
              {busy ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </Pressable>

          <Text className="mt-8 text-center text-[11px] font-extrabold uppercase tracking-wider text-dim">
            or via email code
          </Text>

          {!otpSent ? (
            <>
              <TextInput
                accessibilityLabel="Email address"
                className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm"
                style={{ color: '#E7EBF2' }}
                placeholder="you@example.com"
                placeholderTextColor="#8B94A3"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={emailInput}
                onChangeText={setEmailInput}
              />
              <Pressable
                accessibilityLabel="Email me a magic link"
                disabled={busy}
                className="mt-3 items-center rounded-2xl bg-accent py-4 active:opacity-80"
                onPress={() => void signInWithEmailOtp(emailInput)}
              >
                <Text className="text-sm font-extrabold text-white">
                  {busy ? 'Sending…' : 'Email me a magic link'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="mt-4 text-center text-xs text-dim">
                Code sent to {email}. Enter the 6 digits below.
              </Text>
              <TextInput
                accessibilityLabel="Verification code"
                className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-center text-lg font-extrabold tracking-[0.5em]"
                style={{ color: '#E7EBF2' }}
                placeholder="······"
                placeholderTextColor="#8B94A3"
                keyboardType="number-pad"
                maxLength={6}
                value={codeInput}
                onChangeText={setCodeInput}
              />
              <Pressable
                accessibilityLabel="Verify code"
                disabled={busy}
                className="mt-3 items-center rounded-2xl bg-accent py-4 active:opacity-80"
                onPress={() => void verifyEmailOtp(email ?? emailInput, codeInput)}
              >
                <Text className="text-sm font-extrabold text-white">
                  {busy ? 'Verifying…' : 'Verify & sign in'}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable
            accessibilityLabel="Back to app"
            className="mt-8 items-center py-2"
            onPress={() => router.back()}
          >
            <Text className="text-xs font-bold text-dim">← Not now, stay offline</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
