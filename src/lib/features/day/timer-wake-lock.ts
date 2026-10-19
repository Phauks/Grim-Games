/**
 * Keeps the screen on while the day timer runs (Trevor, 2026-10-19: "seeing timer if screen
 * is closed on phone"). A web app cannot show a live countdown on the lock screen, and the
 * phone suspends it once locked, so the timer's own sound and vibration can't fire then
 * either; keeping the screen awake is what works with no server. Uses the Screen Wake Lock
 * API (w3.org/TR/screen-wake-lock): Chrome and Edge on Android, and iPhone home-screen apps
 * from iOS 18.4 (webkit.org/b/254545). The browser drops the lock whenever the app is hidden,
 * so it is asked for again when the app is shown while still wanted.
 */
let sentinel: WakeLockSentinel | undefined;
let wanted = false;
let listening = false;

/** Whether this browser can keep the screen on. */
export function canKeepAwake(): boolean {
	return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

async function acquire(): Promise<void> {
	if (!wanted || sentinel || document.visibilityState !== 'visible') return;
	try {
		const lock = await navigator.wakeLock.request('screen');
		// Released or no longer wanted while the request was pending.
		if (!wanted) {
			void lock.release();
			return;
		}
		sentinel = lock;
		lock.addEventListener('release', () => {
			if (sentinel === lock) sentinel = undefined;
		});
	} catch {
		// Refused (low battery, power saving, not allowed): the timer still runs.
	}
}

function onVisibility(): void {
	void acquire();
}

/** Holds the screen on (`true`) or lets it sleep again (`false`). */
export function keepScreenAwake(on: boolean): void {
	if (!canKeepAwake()) return;
	wanted = on;
	if (on) {
		if (!listening) {
			document.addEventListener('visibilitychange', onVisibility);
			listening = true;
		}
		void acquire();
		return;
	}
	if (listening) {
		document.removeEventListener('visibilitychange', onVisibility);
		listening = false;
	}
	const lock = sentinel;
	sentinel = undefined;
	if (lock) void lock.release().catch(() => {});
}
