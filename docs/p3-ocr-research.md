# P3 OCR Import — Research Notes (2026-08-25)

## Goal (MASTER-PLAN T3)
Import a syllabus/datesheet from a photo → parse subjects+topics → pre-fill custom onboarding. Cascade behind a provider abstraction.

## OCR provider options (researched)

### 1. On-device: expo-text-extractor (pchalupa/expo-text-extractor)
- Expo module wrapping **Google ML Kit (Android)** + **Apple Vision (iOS)**
- API: `isSupported` + `extractTextFromImage(uri) → string[]`
- Free, offline, private — no API keys, no per-call cost
- ML Kit perf: ~0.05s/image, best-in-class on low-res (bitfactory benchmark); 6× faster than Apple Vision
- **Risk:** third-party lib, single maintainer; needs a prebuild (config plugin or autolink) → fine since we ship release APKs via prebuild already
- Fallback if broken: @InfiniteRed react-native-mlkit (broader but heavier)

### 2. Cloud: Google Cloud Vision API
- Excellent accuracy incl. handwriting-ish print, but: API key management in a client app = leak risk; per-call cost; needs proxy/edge function to protect key
- Verdict: defer until a Supabase Edge Function proxy exists; on-device is enough for printed datesheets

### 3. LLM vision (GPT-4o-mini / Gemini Flash via OpenRouter)
- Best STRUCTURE extraction (raw OCR text → {subject, topics[]} JSON) but costs + latency + key management
- Verdict: this is the PARSING layer, not the OCR layer. Combine: on-device OCR → LLM parse (optional, behind user consent) or local heuristics

## Recommended cascade (provider abstraction)
```
ImagePicker (expo-image-picker, already in Expo)
  → OCR: ExpoTextExtractor.extractTextFromImage(uri)        [on-device, free]
  → Parse v0 (local heuristics): split lines, detect subject headers
      (ALL-CAPS / "Subject:" / numbered lists), topic lines beneath
  → Parse v1 (optional LLM): if user enables it & key present, send OCR text
      to LLM for structured JSON; show diff-preview before applying
  → Preview screen: user ticks which subjects/topics to import
      (reuse onboarding subjects-step UI)
  → store.addCustomSubjects(...) → persist
```

## Design rules (per .hermes.md)
- OCR provider behind `OcrProvider` interface in packages/engine (pure) + apps/mobile adapter — swap ML Kit→cloud later without UI changes
- Parser in packages/engine (pure TS, golden-tested with sample OCR dumps)
- No silent failure: unsupported device / empty OCR result / parse-zero-subjects all show visible states with retry
- Preview-before-apply is mandatory (user curates; never auto-import)

## Next implementation steps
1. packages/engine/src/import/parse.ts — heuristic parser + goldens from real datesheet OCR samples
2. apps/mobile: expo-image-picker + expo-text-extractor wiring behind OcrProvider
3. Import preview route /import/preview
4. Optional LLM parse lane (needs key story — defer)
