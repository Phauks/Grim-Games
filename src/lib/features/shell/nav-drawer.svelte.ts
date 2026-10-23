import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

const HIDDEN_KEY = 'grim-games:nav-collapsed';
/** Where the sidebar shows beside the page instead of the drawer (matches AppNav's CSS). */
const WIDE = '(min-width: 64rem)';

function readHidden(): boolean {
	return readStoredText(HIDDEN_KEY) === '1';
}

/**
 * The navigation menu: a sidebar beside the page on wide screens, a drawer otherwise and on
 * game screens. One hamburger button opens and closes whichever applies (Trevor, 2026-10-16).
 */
class NavMenu {
	/** The drawer (phones, and every width on a game screen). */
	open = $state(false);
	/** The wide-screen sidebar was closed; remembered on the device. */
	hidden = $state(readHidden());
	/** AppNav is on this page (the app's pages, not game screens). */
	sidebarMounted = $state(false);
	wide = $state(globalThis.matchMedia?.(WIDE).matches ?? false);

	constructor() {
		globalThis
			.matchMedia?.(WIDE)
			.addEventListener('change', (event) => (this.wide = event.matches));
	}

	/** Whether the hamburger acts on the sidebar rather than the drawer. */
	get sidebar(): boolean {
		return this.sidebarMounted && this.wide;
	}

	/**
	 * Whether a page's title row carries the hamburger: the app's pages (not game screens,
	 * which have their own) while no sidebar is showing. There is no app header.
	 */
	get pageButton(): boolean {
		return this.sidebarMounted && !(this.wide && !this.hidden);
	}

	/** Whether the menu the hamburger controls is showing. */
	get expanded(): boolean {
		return this.sidebar ? !this.hidden : this.open;
	}

	toggle(): void {
		if (!this.sidebar) {
			this.open = !this.open;
			return;
		}
		this.hidden = !this.hidden;
		// Storage blocked: the choice lasts for this visit.
		writeStoredText(HIDDEN_KEY, this.hidden ? '1' : undefined);
	}

	show(): void {
		this.open = true;
	}
}

export const navDrawer = new NavMenu();
