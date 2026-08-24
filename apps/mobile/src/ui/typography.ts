import type { TextStyle } from 'react-native';

/**
 * Inter font family handles (loaded once in app/_layout.tsx via useFonts).
 * Cycle-1 L2: brand typography — system default read "cheap" (ux-loop-cycle1 #9).
 */
export const INTER = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/**
 * Numeric UI style: Inter medium + tabular numerals so digit widths are
 * uniform — timers/stat numbers never reflow as values tick (#9, Hevy spec).
 * Spread into any Text's style that displays changing numbers.
 */
export const tNum: TextStyle = {
  fontFamily: INTER.medium,
  fontVariant: ['tabular-nums'],
};

/** Same as tNum but extrabold — big stat/percent numerals. */
export const tNumStrong: TextStyle = {
  fontFamily: INTER.extrabold,
  fontVariant: ['tabular-nums'],
};
