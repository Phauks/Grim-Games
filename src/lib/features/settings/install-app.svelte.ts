import {
	installRoute,
	type BrowserInfo,
	type InstallRoute
} from '#lib/core/install/install-route.ts';
import { thisBrowser } from './data/keep-data.ts';

/** Chromium's install prompt event (not in the DOM types; web.dev "Provide a custom install experience"). */
interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Install app, at the bottom of Settings (Trevor, 2026-10-20: no technical know-how needed) and
 * as a button in the menu (2026-11-16, option B). Chromium browsers fire `beforeinstallprompt`
 * when the app can be installed; it is held so the button can show the browser's own prompt.
 * Everywhere else that can install by hand (Safari, Chrome on an iPhone, Firefox on Android) the
 * button opens the Install app dialog with that browser's steps, and an app's own web view (the
 * Google app) is told to open the page in Safari or Chrome first (install-route.ts). Opened as an
 * installed app, or in a desktop browser with no prompt, there is no button (platform gaps list,
 * /mnt/project-files/platform-gaps.md).
 */
class InstallApp {
	#prompt = $state<InstallPromptEvent | null>(null);
	#installed = $state(false);
	#browser = $state<BrowserInfo | null>(null);
	/** The Install app dialog, drawn once in the layout. */
	dialog = $state(false);

	/** How this browser installs the app; null hides every Install app button. */
	get route(): InstallRoute {
		if (!this.#browser || this.#installed) return null;
		return installRoute(this.#browser, this.#prompt !== null);
	}

	/** Listens from the first page on, before Settings has loaded. Returns a function that stops. */
	listen(): () => void {
		this.#browser = thisBrowser();
		this.#installed = this.#browser.standalone;
		const held = (event: Event) => {
			// Kept for the button instead of the browser's own banner (Trevor bars banners).
			event.preventDefault();
			this.#prompt = event as InstallPromptEvent;
		};
		const installed = () => {
			this.#installed = true;
			this.#prompt = null;
			this.dialog = false;
		};
		addEventListener('beforeinstallprompt', held);
		addEventListener('appinstalled', installed);
		return () => {
			removeEventListener('beforeinstallprompt', held);
			removeEventListener('appinstalled', installed);
		};
	}

	/** What every Install app button does: the browser's own prompt, or the steps. */
	start(): void {
		if (this.route === 'prompt') void this.#showPrompt();
		else if (this.route) this.dialog = true;
	}

	/** A prompt is used once; the browser offers a new one later. */
	async #showPrompt(): Promise<void> {
		const event = this.#prompt;
		if (!event) return;
		this.#prompt = null;
		await event.prompt();
		if ((await event.userChoice).outcome === 'accepted') this.#installed = true;
	}
}

export const installApp = new InstallApp();
