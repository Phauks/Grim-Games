import { needsHomeScreen, thisBrowser } from './data/keep-data.ts';

/** Chromium's install prompt event (not in the DOM types; web.dev "Provide a custom install experience"). */
interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Install as app, at the bottom of Settings (Trevor, 2026-10-20: no technical know-how
 * needed). Chromium browsers fire `beforeinstallprompt` when the app can be installed; it is
 * held so the button can show the browser's own install prompt. Safari on an iPhone or iPad has
 * no install API, so the button shows the Add to Home Screen steps instead. Opened as an
 * installed app, or in a browser that offers neither (Firefox, desktop Safari), there is no
 * button (platform gaps list, /mnt/project-files/platform-gaps.md).
 */
class InstallApp {
	#prompt = $state<InstallPromptEvent | null>(null);
	#steps = $state(false);
	#installed = $state(false);

	/** How this browser installs the app: its own prompt, written steps, or not at all. */
	get way(): 'prompt' | 'steps' | null {
		if (this.#installed) return null;
		if (this.#prompt) return 'prompt';
		return this.#steps ? 'steps' : null;
	}

	/** Listens from the first page on, before Settings has loaded. Returns a function that stops. */
	listen(): () => void {
		const browser = thisBrowser();
		this.#installed = browser.standalone;
		this.#steps = needsHomeScreen(browser);
		const held = (event: Event) => {
			// Kept for the button instead of the browser's own banner (Trevor bars banners).
			event.preventDefault();
			this.#prompt = event as InstallPromptEvent;
		};
		const installed = () => {
			this.#installed = true;
			this.#prompt = null;
		};
		addEventListener('beforeinstallprompt', held);
		addEventListener('appinstalled', installed);
		return () => {
			removeEventListener('beforeinstallprompt', held);
			removeEventListener('appinstalled', installed);
		};
	}

	/** Shows the browser's install prompt. A prompt is used once; the browser offers a new one later. */
	async install(): Promise<void> {
		const event = this.#prompt;
		if (!event) return;
		this.#prompt = null;
		await event.prompt();
		if ((await event.userChoice).outcome === 'accepted') this.#installed = true;
	}
}

export const installApp = new InstallApp();
