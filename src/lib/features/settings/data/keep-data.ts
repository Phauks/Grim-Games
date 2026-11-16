import { installRoute, type BrowserInfo } from '#lib/core/install/install-route.ts';

/**
 * Keeping this device's saved data (Storage plan, Trevor 2026-10-18: "follow your
 * recommendation"). Without persistent storage a browser may clear the app's games and
 * settings to free up space; Safari also deletes everything a site stored after seven days of
 * use without a visit, unless the site was added to the Home Screen (WebKit, "Full Third-Party
 * Cookie Blocking and More", 2020).
 */

/** Asks silently: true when the browser keeps the data, null when it can't say. */
export async function askToKeepData(): Promise<boolean | null> {
	try {
		const storage = navigator.storage;
		if (!storage?.persist || !storage.persisted) return null;
		return (await storage.persisted()) || (await storage.persist());
	} catch {
		return null;
	}
}

/**
 * Always on, with no setting (Trevor, 2026-10-19): asks at every start, and again when the app
 * is installed. Chromium grants it from how much the site is used and whether it is installed,
 * so a later ask can succeed where the first did not; Firefox shows a prompt, so it is never
 * asked more than that (MDN, "Storage quotas and eviction criteria"). Diagnostics reports the
 * answer for bug reports. Returns a function that stops listening.
 */
export function keepData(): () => void {
	const ask = () => void askToKeepData();
	addEventListener('appinstalled', ask);
	ask();
	return () => removeEventListener('appinstalled', ask);
}

/**
 * Safari on an iPhone or iPad, not opened from the Home Screen: the one case where the
 * seven-day deletion applies, so Settings > Data offers Add to Home Screen. An app's own web
 * view (the Google app) says Safari too, but has no Add to Home Screen (install-route.ts).
 */
export function needsHomeScreen(browser: BrowserInfo): boolean {
	return installRoute(browser, false) === 'ios-safari';
}

/** This browser, for needsHomeScreen and the Install app dialog. */
export function thisBrowser(): BrowserInfo {
	const standalone =
		(navigator as Navigator & { standalone?: boolean }).standalone === true ||
		matchMedia('(display-mode: standalone)').matches;
	return { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone };
}
