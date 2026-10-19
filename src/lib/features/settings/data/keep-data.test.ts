import { afterEach, describe, expect, it, vi } from 'vitest';
import { askToKeepData, keepData, needsHomeScreen } from './keep-data.ts';

const IPHONE_SAFARI =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('Add to Home Screen row', () => {
	it('shows for Safari on an iPhone or iPad not opened from the Home Screen', () => {
		const browser = { maxTouchPoints: 5, standalone: false };
		expect(needsHomeScreen({ ...browser, userAgent: IPHONE_SAFARI })).toBe(true);
		// An iPad asking for the desktop site says Macintosh but has touch points.
		expect(needsHomeScreen({ ...browser, userAgent: IPAD_DESKTOP })).toBe(true);
		expect(needsHomeScreen({ ...browser, maxTouchPoints: 0, userAgent: IPAD_DESKTOP })).toBe(false);
	});

	it('not from the Home Screen, in other browsers, or off iOS', () => {
		const browser = { maxTouchPoints: 5, standalone: false };
		expect(needsHomeScreen({ ...browser, standalone: true, userAgent: IPHONE_SAFARI })).toBe(false);
		expect(needsHomeScreen({ ...browser, userAgent: IPHONE_CHROME })).toBe(false);
		expect(needsHomeScreen({ ...browser, userAgent: ANDROID })).toBe(false);
	});
});

describe('asking the browser to keep the data', () => {
	afterEach(() => vi.unstubAllGlobals());

	const stub = (storage: Partial<StorageManager> | undefined) =>
		vi.stubGlobal('navigator', { storage });

	it('asks only when not already kept', async () => {
		const persist = vi.fn(async () => true);
		stub({ persisted: async () => false, persist });
		expect(await askToKeepData()).toBe(true);
		expect(persist).toHaveBeenCalledOnce();

		const again = vi.fn(async () => true);
		stub({ persisted: async () => true, persist: again });
		expect(await askToKeepData()).toBe(true);
		expect(again).not.toHaveBeenCalled();
	});

	it('says null when the browser cannot say, or fails', async () => {
		stub(undefined);
		expect(await askToKeepData()).toBeNull();
		stub({
			persisted: async () => {
				throw new Error('blocked');
			},
			persist: async () => true
		});
		expect(await askToKeepData()).toBeNull();
	});

	it('a refusal reads as not kept', async () => {
		stub({ persisted: async () => false, persist: async () => false });
		expect(await askToKeepData()).toBe(false);
	});

	it('asks at start and again when the app is installed, until stopped', async () => {
		const persist = vi.fn(async () => false);
		const listeners = new Map<string, () => void>();
		stub({ persisted: async () => false, persist });
		vi.stubGlobal('addEventListener', (type: string, fn: () => void) => listeners.set(type, fn));
		vi.stubGlobal('removeEventListener', (type: string) => listeners.delete(type));
		const stop = keepData();
		await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
		listeners.get('appinstalled')?.();
		await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
		stop();
		expect(listeners.has('appinstalled')).toBe(false);
	});
});
