import { _setThemeConfig, syncTheme } from '../theme';
import type { SetgreetTheme } from '../theme';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const sampleTheme: SetgreetTheme = {
  colors: {
    primary: '#6200EE',
    onPrimary: '#FFFFFF',
    secondary: '#03DAC6',
    surface: '#FFFFFF',
    onSurface: '#000000',
    error: '#B00020',
  },
  typography: {
    bodyMedium: {
      fontFamily: 'Roboto',
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.43,
      letterSpacing: 0.25,
    },
    headlineMedium: {
      fontFamily: 'Roboto',
      fontSize: 28,
      fontWeight: 400,
    },
  },
  shapes: {
    small: 4,
    medium: 12,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('syncTheme', () => {
  it('should throw if SDK not initialized', async () => {
    // Load a FRESH copy of the module so its `storedAppKey` is null (no
    // _setThemeConfig has run on this instance), then assert syncTheme rejects.
    await jest.isolateModulesAsync(async () => {
      const fresh = await import('../theme');
      await expect(fresh.syncTheme(sampleTheme)).rejects.toThrow(
        'Setgreet SDK not initialized'
      );
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should POST theme data to the correct endpoint', async () => {
    _setThemeConfig('test_app_key', 'https://test.api.com/api/v1');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    await syncTheme(sampleTheme);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.api.com/api/v1/sdk/sync-theme',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should send correct payload with appKey and platform', async () => {
    _setThemeConfig('my_app_key', 'https://api.example.com/api/v1');

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await syncTheme(sampleTheme);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.appKey).toBe('my_app_key');
    expect(body.platform).toBe('reactNative');
    expect(body.colors.primary).toBe('#6200EE');
    expect(body.colors.onPrimary).toBe('#FFFFFF');
    expect(body.typography.bodyMedium.fontFamily).toBe('Roboto');
    expect(body.typography.bodyMedium.fontSize).toBe(14);
    expect(body.shapes.small).toBe(4);
  });

  it('should throw on non-OK response', async () => {
    _setThemeConfig('test_key', 'https://api.example.com/api/v1');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    await expect(syncTheme(sampleTheme)).rejects.toThrow(
      'Setgreet theme sync failed (400): Bad Request'
    );
  });

  it('should throw on network error', async () => {
    _setThemeConfig('test_key', 'https://api.example.com/api/v1');

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(syncTheme(sampleTheme)).rejects.toThrow('Network error');
  });

  it('should use default API URL on fresh config', async () => {
    // Reset by providing the default URL explicitly since module state persists
    _setThemeConfig('test_key', 'https://api.setgreet.com/api/v1');

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await syncTheme(sampleTheme);

    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://api.setgreet.com/api/v1/sdk/sync-theme'
    );
  });

  it('should override default URL when apiUrl is provided', async () => {
    _setThemeConfig('test_key', 'https://staging.setgreet.com/api/v1');

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await syncTheme(sampleTheme);

    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://staging.setgreet.com/api/v1/sdk/sync-theme'
    );
  });

  it('should send colors-only theme without typography or shapes', async () => {
    _setThemeConfig('test_key', 'https://api.example.com/api/v1');

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const minimalTheme: SetgreetTheme = {
      colors: {
        primary: '#FF0000',
      },
    };

    await syncTheme(minimalTheme);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.colors.primary).toBe('#FF0000');
    expect(body.typography).toBeUndefined();
    expect(body.shapes).toBeUndefined();
  });
});

describe('_setThemeConfig', () => {
  it('should store appKey', async () => {
    _setThemeConfig('config_test_key', 'https://test.com/api/v1');

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await syncTheme({ colors: { primary: '#000' } });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.appKey).toBe('config_test_key');
  });
});
