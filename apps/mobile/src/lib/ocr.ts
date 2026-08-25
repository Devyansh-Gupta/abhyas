/**
 * P3 OCR import — provider seam (docs/p3-ocr-research.md).
 *
 * `extractText(uri)` is the only surface the /import screen knows about.
 * Today it resolves to expo-text-extractor (on-device ML Kit / Apple Vision);
 * a cloud or LLM-vision provider can replace it later without UI changes.
 *
 * The module is imported DYNAMICALLY so that:
 *  - a build where the native module isn't linked (e.g. Expo Go, or a
 *    prebuild that dropped the autolink) fails gracefully at runtime instead
 *    of crashing at import time;
 *  - node-side tests of callers never touch native code paths.
 */

/** Thrown when text recognition cannot run on this device/build. */
export class OcrUnavailableError extends Error {
  readonly name = 'OcrUnavailableError';
  constructor(detail?: string) {
    super(
      detail ??
        'Text recognition is not available on this device/build (on-device OCR module missing).',
    );
  }
}

interface TextExtractorModule {
  extractTextFromImage(uri: string): Promise<string[]>;
  isSupported?: boolean | Promise<boolean>;
}

/**
 * Run on-device OCR over an image URI → raw text lines.
 * Rejects with {@link OcrUnavailableError} when the provider is missing or
 * broken; callers must render a visible retry state (no silent failure).
 */
export async function extractText(uri: string): Promise<string[]> {
  let mod: TextExtractorModule;
  try {
    mod = await import('expo-text-extractor');
  } catch {
    throw new OcrUnavailableError();
  }
  if (typeof mod.extractTextFromImage !== 'function') {
    throw new OcrUnavailableError();
  }
  try {
    return await mod.extractTextFromImage(uri);
  } catch (err) {
    // Native-layer failure (unsupported OS version, engine init error…) is the
    // same user-facing condition as "provider missing": typed + visible.
    throw new OcrUnavailableError(err instanceof Error ? err.message : undefined);
  }
}
