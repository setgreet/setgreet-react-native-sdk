/**
 * Theme types and sync for Setgreet React Native SDK.
 *
 * React Native does not have a centralized theme system like Android (Material 3)
 * or iOS (UIKit appearance). Developers provide their app's theme manually via
 * `syncTheme()`, which posts the data to the Setgreet backend.
 */

// ============================================
// Types
// ============================================

/**
 * Color scheme following Material 3 semantic naming.
 * Provide as many colors as your app uses — only `primary` and `surface` are required.
 */
export interface SetgreetColorScheme {
  primary: string;
  onPrimary?: string;
  primaryContainer?: string;
  onPrimaryContainer?: string;
  secondary?: string;
  onSecondary?: string;
  secondaryContainer?: string;
  onSecondaryContainer?: string;
  tertiary?: string;
  onTertiary?: string;
  tertiaryContainer?: string;
  onTertiaryContainer?: string;
  surface?: string;
  onSurface?: string;
  surfaceVariant?: string;
  onSurfaceVariant?: string;
  error?: string;
  onError?: string;
  outline?: string;
  outlineVariant?: string;
  [key: string]: string | undefined;
}

/**
 * Type style for a single typography entry.
 */
export interface SetgreetTypeStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
}

/**
 * Typography configuration using Material 3 type scale names.
 * Provide as many entries as needed.
 */
export interface SetgreetTypography {
  displayLarge?: SetgreetTypeStyle;
  displayMedium?: SetgreetTypeStyle;
  displaySmall?: SetgreetTypeStyle;
  headlineLarge?: SetgreetTypeStyle;
  headlineMedium?: SetgreetTypeStyle;
  headlineSmall?: SetgreetTypeStyle;
  titleLarge?: SetgreetTypeStyle;
  titleMedium?: SetgreetTypeStyle;
  titleSmall?: SetgreetTypeStyle;
  bodyLarge?: SetgreetTypeStyle;
  bodyMedium?: SetgreetTypeStyle;
  bodySmall?: SetgreetTypeStyle;
  labelLarge?: SetgreetTypeStyle;
  labelMedium?: SetgreetTypeStyle;
  labelSmall?: SetgreetTypeStyle;
  [key: string]: SetgreetTypeStyle | undefined;
}

/**
 * Theme data to sync with Setgreet.
 */
export interface SetgreetTheme {
  colors: SetgreetColorScheme;
  typography?: SetgreetTypography;
  shapes?: Record<string, number>;
}

// ============================================
// Internal State
// ============================================

let storedAppKey: string | null = null;
let storedApiUrl: string | null = null;

/**
 * @internal Called by initialize() to store the app key for theme sync.
 */
export function _setThemeConfig(appKey: string, apiUrl?: string): void {
  storedAppKey = appKey;
  storedApiUrl = apiUrl || 'https://api.setgreet.com/api/v1';
}

// ============================================
// Public API
// ============================================

/**
 * Sync your app's theme with Setgreet.
 *
 * Since React Native does not have a centralized theme system, call this
 * function with your app's color palette and typography to enable
 * theme-aware flow screens in the Setgreet editor.
 *
 * @example
 * ```typescript
 * import { syncTheme } from '@setgreet/react-native-sdk';
 *
 * syncTheme({
 *   colors: {
 *     primary: '#6200EE',
 *     onPrimary: '#FFFFFF',
 *     secondary: '#03DAC6',
 *     surface: '#FFFFFF',
 *     onSurface: '#000000',
 *     error: '#B00020',
 *   },
 *   typography: {
 *     bodyMedium: {
 *       fontFamily: 'Roboto',
 *       fontSize: 14,
 *       fontWeight: 400,
 *     },
 *     headlineMedium: {
 *       fontFamily: 'Roboto',
 *       fontSize: 28,
 *       fontWeight: 400,
 *     },
 *   },
 * });
 * ```
 */
export async function syncTheme(theme: SetgreetTheme): Promise<void> {
  if (!storedAppKey) {
    throw new Error(
      'Setgreet SDK not initialized. Call initialize() before syncTheme().'
    );
  }

  const payload = {
    appKey: storedAppKey,
    platform: 'reactNative' as const,
    colors: theme.colors,
    typography: theme.typography,
    shapes: theme.shapes,
  };

  const url = `${storedApiUrl}/sdk/sync-theme`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Setgreet theme sync failed (${response.status}): ${text}`);
  }
}
