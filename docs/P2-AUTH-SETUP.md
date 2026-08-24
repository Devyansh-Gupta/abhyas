# P2 Auth Setup — Google native sign-in (manual, one-time)

The email-OTP flow works with zero extra setup (Supabase handles delivery once
SMTP or the built-in rate limits are acceptable). **Google sign-in needs the
following manual steps before `expo prebuild`/device runs** — they cannot be
automated from this repo:

1. **Supabase dashboard** → project `auwtcvrrouycvhahcowy` → Auth → Providers →
   Google: enable it and paste the *Web* OAuth client ID + secret from Google
   Cloud Console.
2. **Google Cloud Console** → APIs & Services → Credentials:
   - Create an **OAuth 2.0 Web client** (used by Supabase and passed to the
     Google SDK as `webClientId`).
   - Create an **Android OAuth client** with package name
     `com.studysync.abhyas` and BOTH SHA-1 fingerprints:
     - debug keystore (`~/.android/debug.keystore`, alias `androiddebugkey`)
     - release keystore SHA-1 when you ship.
   - (iOS builds additionally need an iOS client + reversed-client-id URL scheme
     via the google-signin plugin's `iosUrlScheme` prop.)
3. Put the web client id in `apps/mobile/.env` as
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<id>` (auth.ts reads it for
   `GoogleSignin.configure`).
4. Re-run `expo prebuild` so the `@react-native-google-signin/google-signin`
   config plugin (already registered in `app.json`) injects the native deps.

Until step 2 is done, the Google button on `/auth` will surface a visible error
(F21/F24) instead of failing silently; email OTP and offline-only mode work.
