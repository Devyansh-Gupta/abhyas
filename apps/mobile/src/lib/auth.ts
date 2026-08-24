/**
 * Auth slice (P2): Google native sign-in + email OTP, exposed as a small Zustand
 * store so any screen can read `userId` / `error` without a context provider.
 *
 * ── Failure policy (F21/F24 — no silent failure) ────────────────────────────────
 * Every failed attempt writes a human-readable message into `useAuth.error`;
 * the /auth screen renders it. Nothing here swallows errors.
 *
 * ── Node safety ─────────────────────────────────────────────────────────────────
 * google-signin is imported dynamically inside signInWithGoogle() only; zustand
 * and @supabase/supabase-js are Node-safe at top level.
 */
import { create } from 'zustand';
import { getSupabase, supabaseEnabled } from './supabase';

export type AuthStatus = 'idle' | 'signing-in' | 'signed-in' | 'signed-out';

interface AuthState {
  userId: string | null;
  email: string | null;
  status: AuthStatus;
  /** Last visible error (rendered by the auth screen); null when all clear. */
  error: string | null;
  /** True after signInWithOtp succeeded and the user should enter the code. */
  otpSent: boolean;
  clearError(): void;
}

export const useAuth = create<AuthState>(set => ({
  userId: null,
  email: null,
  status: 'idle',
  error: null,
  otpSent: false,
  clearError: () => set({ error: null }),
}));

function setSignedIn(userId: string | null, email: string | null): void {
  useAuth.setState({
    userId,
    email,
    status: userId ? 'signed-in' : 'signed-out',
    error: null,
    otpSent: false,
  });
}

function fail(message: string): void {
  console.warn(`[auth] ${message}`);
  useAuth.setState(state => ({
    error: message,
    status: state.userId ? 'signed-in' : 'signed-out',
  }));
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

/**
 * Native Google sign-in → Supabase ID-token exchange.
 * Requires the manual Google Cloud Console setup noted in docs/P2-AUTH-SETUP.md
 * (OAuth web client id + Android SHA-1). Returns true on success.
 */
export async function signInWithGoogle(): Promise<boolean> {
  if (!supabaseEnabled) {
    fail('Sign-in unavailable: Supabase is not configured on this build.');
    return false;
  }
  useAuth.setState({ status: 'signing-in', error: null });
  try {
    const [{ GoogleSignin }, client] = await Promise.all([
      import('@react-native-google-signin/google-signin'),
      getSupabase(),
    ]);
    if (!client) throw new Error('Supabase client unavailable.');
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
      offlineAccess: false,
    });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    // v13+ returns { type: 'cancelled' } | { type: 'success', data }; older shapes
    // returned the data object directly — normalize defensively.
    const data =
      result && typeof result === 'object' && 'data' in result
        ? (result.data as { idToken?: string } | null)
        : (result as { idToken?: string } | null);
    if (!data?.idToken) throw new Error('Google sign-in was cancelled or returned no token.');
    const { data: sessionData, error } = await client.auth.signInWithIdToken({
      provider: 'google',
      token: data.idToken,
    });
    if (error) throw new Error(`Google sign-in rejected: ${error.message}`);
    setSignedIn(sessionData.user?.id ?? null, sessionData.user?.email ?? null);
    return true;
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Step 1 of the email flow: send a 6-digit OTP to `email`. */
export async function signInWithEmailOtp(email: string): Promise<boolean> {
  if (!supabaseEnabled) {
    fail('Sign-in unavailable: Supabase is not configured on this build.');
    return false;
  }
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    fail('Enter a valid email address first.');
    return false;
  }
  useAuth.setState({ status: 'signing-in', error: null });
  try {
    const client = await getSupabase();
    if (!client) throw new Error('Supabase client unavailable.');
    const { error } = await client.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(`Could not send the code: ${error.message}`);
    useAuth.setState({ status: 'idle', otpSent: true, email: trimmed, error: null });
    return true;
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Step 2 of the email flow: verify the 6-digit code from the inbox. */
export async function verifyEmailOtp(email: string, token: string): Promise<boolean> {
  if (!supabaseEnabled) {
    fail('Sign-in unavailable: Supabase is not configured on this build.');
    return false;
  }
  const code = token.trim();
  if (!/^\d{6}$/.test(code)) {
    fail('Enter the 6-digit code from your email.');
    return false;
  }
  useAuth.setState({ status: 'signing-in', error: null });
  try {
    const client = await getSupabase();
    if (!client) throw new Error('Supabase client unavailable.');
    const { data, error } = await client.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'email',
    });
    if (error) throw new Error(`Code verification failed: ${error.message}`);
    setSignedIn(data.user?.id ?? null, data.user?.email ?? null);
    return true;
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function signOut(): Promise<boolean> {
  try {
    const client = await getSupabase();
    if (!client) throw new Error('Supabase client unavailable.');
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
    setSignedIn(null, null);
    return true;
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Current session, or null when disabled/unavailable/not signed in. */
export async function getSession(): Promise<{ userId: string; email: string | null } | null> {
  if (!supabaseEnabled) return null;
  const client = await getSupabase();
  if (!client) return null;
  const {
    data: { session },
    error,
  } = await client.auth.getSession();
  if (error) {
    console.error('[auth] getSession failed:', error.message);
    return null;
  }
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email ?? null };
}

let unsubscribe: (() => void) | null = null;

/**
 * Subscribe to supabase auth changes and mirror them into the zustand slice.
 * Call once from the root layout; idempotent. Returns an unsubscribe fn.
 */
export function startAuthListener(): () => void {
  if (unsubscribe) return unsubscribe;
  if (!supabaseEnabled) {
    // Visible, once — the offline-only state is already warned by lib/supabase.
    console.warn('[auth] listener not started: Supabase disabled.');
    return () => {};
  }
  void (async () => {
    const client = await getSupabase();
    if (!client) {
      console.warn('[auth] listener not started: client unavailable.');
      return;
    }
    // Restore any persisted session immediately.
    const restored = await getSession();
    if (restored && !useAuth.getState().userId) {
      setSignedIn(restored.userId, restored.email);
    }
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session) setSignedIn(session.user.id, session.user.email ?? null);
      } else if (event === 'SIGNED_OUT') {
        setSignedIn(null, null);
      }
    });
    unsubscribe = () => data.subscription.unsubscribe();
  })();
  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}
