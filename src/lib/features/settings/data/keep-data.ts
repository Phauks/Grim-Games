/**
 * Keeping this device's saved data (Storage plan, Trevor 2026-10-18: "follow your
 * recommendation"). Without persistent storage a browser may clear the app's games and
 * settings to free up space; Safari also deletes everything a site stored after seven days of
 * use without a visit, unless the site was added to the Home Screen (WebKit, "Full Third-Party
 * Cookie Blocking and More", 2020).
 */

/** Asks once, silently, at startup: true when the browser keeps the data, null when it can't say. */
export async function askToKeepData(): Promise<boolean | null> {
	try {
		const storage = navigator.storage;
		if (!storage?.persist || !storage.persisted) return null;
		return (await storage.persisted()) || (await storage.persist());
	} catch {
		return null;
	}
}

/** Whether the browser keeps the data now, without asking; null when it can't say. */
export async function dataKept(): Promise<boolean | null> {
	try {
		return (await navigator.storage?.persisted?.()) ?? null;
	} catch {
		return null;
	}
}

export interface BrowserInfo {
	userAgent: string;
	/** Touch points: an iPad asking for the desktop site says "Macintosh" but has them. */
	maxTouchPoints: number;
	/** Opened from the Home Screen (navigator.standalone or display-mode: standalone). */
	standalone: boolean;
}

/**
 * Safari on an iPhone or iPad, not opened from the Home Screen: the one case where the
 * seven-day deletion applies, so Settings > Data offers Add to Home Screen.
 */
export function needsHomeScreen({ userAgent, maxTouchPoints, standalone }: BrowserInfo): boolean {
	if (standalone) return false;
	const ios =
		/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
	// Other iOS browsers name themselves; only Safari has the Add to Home Screen this row describes.
	const safari = /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
	return ios && safari;
}

/** This browser, for needsHomeScreen. */
export function thisBrowser(): BrowserInfo {
	const standalone =
		(navigator as Navigator & { standalone?: boolean }).standalone === true ||
		matchMedia('(display-mode: standalone)').matches;
	return { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone };
}
