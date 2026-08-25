#!/usr/bin/env bash
# Dev loop: hot-reload Abhyas on MEmu via Metro — seconds per change, not 40 min.
# One-time: build+install the debug dev-client (gh workflow run apk.yml -f build_type=debug)
# Then run this script whenever you want a live session.
set -e
ADB="${ADB:-$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe}"
S="${MEMU_SERIAL:-127.0.0.1:21503}"
cd "$(dirname "$0")/../apps/mobile"

echo "[devloop] ensuring adb device $S"
"$ADB" connect "$S" >/dev/null 2>&1 || true
"$ADB" -s "$S" get-state >/dev/null

echo "[devloop] reverse port 8081 so the device reaches THIS machine's Metro"
"$ADB" -s "$S" reverse tcp:8081 tcp:8081

echo "[devloop] starting Metro (background) — leave it running while iterating"
npx react-native start &
METRO_PID=$!
sleep 6

echo "[devloop] launching app on device"
"$ADB" -s "$S" shell monkey -p com.studysync.abhyas -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

echo "[devloop] ready. Edit code — changes hot-reload on the emulator."
echo "[devloop] press Ctrl+C to stop Metro."
trap "kill $METRO_PID 2>/dev/null" EXIT
wait $METRO_PID
