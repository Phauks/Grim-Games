/**
 * How this browser can install the app (the Install app dialog, Trevor 2026-11-16: option B).
 * Read from the user agent, since no browser says whether it can add a page to the Home Screen.
 *
 * - `prompt`: a Chromium browser offered its own install prompt (`beforeinstallprompt`).
 * - `ios-safari`: Safari, or a Safari view inside another app, on an iPhone or iPad: Share, Add to
 *   Home Screen (firt.dev "iOS PWA Compatibility": Safari View Controller since iOS 17).
 * - `ios-browser`: Chrome, Edge or Firefox on an iPhone or iPad, which offer Add to Home Screen in
 *   their Share sheet since iOS 16.4 (9to5Mac, 2023-07-14, "Google Chrome web apps iOS").
 * - `ios-in-app`: an app's own web view (the Google app, Instagram, Facebook): no Add to Home
 *   Screen, so the page has to be opened in Safari first. Its user agent has `Safari/` but no
 *   `Version/` (Chromium "User Agent in Chrome for iOS"; Joomla issue 3947 on `GSA/`).
 * - `android-menu`: an Android browser with no prompt (Firefox, or Chrome before it offers one):
 *   its menu has Install (Mozilla support, "Use web apps with Firefox for Android").
 * - `android-in-app`: an Android app's web view (`; wv)` in the user agent), which can't install.
 * - `null`: already installed, or a desktop browser with no prompt (Safari, Firefox).
 */
export type InstallRoute =
	'prompt' | 'ios-safari' | 'ios-browser' | 'ios-in-app' | 'android-menu' | 'android-in-app' | null;

export interface BrowserInfo {
	userAgent: string;
	/** Touch points: an iPad asking for the desktop site says "Macintosh" but has them. */
	maxTouchPoints: number;
	/** Opened from the Home Screen (navigator.standalone or display-mode: standalone). */
	standalone: boolean;
}

/** An iPhone, iPod or iPad, including an iPad asking for the desktop site. */
export function isIos({ userAgent, maxTouchPoints }: BrowserInfo): boolean {
	return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function installRoute(browser: BrowserInfo, hasPrompt: boolean): InstallRoute {
	if (browser.standalone) return null;
	if (hasPrompt) return 'prompt';
	const ua = browser.userAgent;
	if (isIos(browser)) {
		if (/CriOS|FxiOS|EdgiOS/.test(ua)) return 'ios-browser';
		if (/Version\/[\d.]+.*Safari\//.test(ua)) return 'ios-safari';
		return 'ios-in-app';
	}
	if (/Android/.test(ua)) return /; wv\)/.test(ua) ? 'android-in-app' : 'android-menu';
	return null;
}

/** The app whose web view this is, for the dialog to name; null when it doesn't say. */
export function inAppHost(userAgent: string): 'google' | 'instagram' | 'facebook' | null {
	if (/GSA\//.test(userAgent)) return 'google';
	if (/Instagram/.test(userAgent)) return 'instagram';
	if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return 'facebook';
	return null;
}

/**
 * The link that opens this page outside an app's web view: Safari's undocumented
 * `x-safari-https://` scheme on iOS 17 and later (WebKit bug 240025, comment on leaving in-app
 * browsers), or a Chrome intent on Android (developer.chrome.com "Android Intents with Chrome").
 * Either can fail, so the dialog also offers Copy link.
 */
export function openOutsideLink(route: 'ios-in-app' | 'android-in-app', url: string): string {
	if (route === 'ios-in-app') return `x-safari-${url}`;
	// The intent's own fields follow #, so the page's hash can't go in its path.
	const { protocol, host, pathname, search } = new URL(url);
	const scheme = protocol.replace(':', '');
	const fallback = encodeURIComponent(url);
	return `intent://${host}${pathname}${search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}
