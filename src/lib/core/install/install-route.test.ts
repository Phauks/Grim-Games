import { describe, expect, it } from 'vitest';
import { inAppHost, installRoute, openOutsideLink } from './install-route.ts';

const IPHONE_SAFARI =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
const IPHONE_GOOGLE_APP =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/390.0.812345 Mobile/15E148 Safari/604.1';
const IPHONE_INSTAGRAM =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone14,5; iOS 18_6)';
const IPHONE_CHROME =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.77 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15';
const ANDROID_CHROME =
	'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36';
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0';
const ANDROID_WEBVIEW =
	'Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0 Mobile Safari/537.36 Instagram 350.0';

const tab = { maxTouchPoints: 5, standalone: false };
const route = (userAgent: string, more: Partial<typeof tab> = {}, prompt = false) =>
	installRoute({ ...tab, ...more, userAgent }, prompt);

describe('how this browser installs the app', () => {
	it('uses the browser prompt when it offered one', () => {
		expect(route(ANDROID_CHROME, {}, true)).toBe('prompt');
	});

	it('shows nothing once opened from the Home Screen', () => {
		expect(route(IPHONE_SAFARI, { standalone: true })).toBeNull();
		expect(route(ANDROID_CHROME, { standalone: true }, true)).toBeNull();
	});

	it('Safari steps in Safari on an iPhone, or an iPad asking for the desktop site', () => {
		expect(route(IPHONE_SAFARI)).toBe('ios-safari');
		expect(route(IPAD_DESKTOP)).toBe('ios-safari');
		// A Mac has no touch points: no install steps.
		expect(route(IPAD_DESKTOP, { maxTouchPoints: 0 })).toBeNull();
	});

	it("the Google app's window is not Safari, though it says Safari/", () => {
		expect(route(IPHONE_GOOGLE_APP)).toBe('ios-in-app');
		expect(route(IPHONE_INSTAGRAM)).toBe('ios-in-app');
		expect(inAppHost(IPHONE_GOOGLE_APP)).toBe('google');
		expect(inAppHost(IPHONE_INSTAGRAM)).toBe('instagram');
		expect(inAppHost(IPHONE_SAFARI)).toBeNull();
	});

	it('Chrome on an iPhone gets its own Share steps', () => {
		expect(route(IPHONE_CHROME)).toBe('ios-browser');
	});

	it("an Android browser with no prompt uses its menu; an app's web view can't install", () => {
		expect(route(ANDROID_FIREFOX)).toBe('android-menu');
		expect(route(ANDROID_CHROME)).toBe('android-menu');
		expect(route(ANDROID_WEBVIEW)).toBe('android-in-app');
	});
});

describe('opening the page outside an app', () => {
	it('in Safari on iOS, keeping the whole address', () => {
		expect(openOutsideLink('ios-in-app', 'https://grimbinder.com/join/ABC#k')).toBe(
			'x-safari-https://grimbinder.com/join/ABC#k'
		);
	});

	it('in Chrome on Android, with the address as the fallback', () => {
		expect(openOutsideLink('android-in-app', 'https://grimbinder.com/join/ABC?x=1')).toBe(
			'intent://grimbinder.com/join/ABC?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fgrimbinder.com%2Fjoin%2FABC%3Fx%3D1;end'
		);
	});
});
