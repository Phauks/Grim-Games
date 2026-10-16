const HIDDEN_KEY = 'grim-games:nav-collapsed';
/** Where the sidebar shows beside the page instead of the drawer (matches AppNav's CSS). */
const WIDE = '(min-width: 64rem)';

function readHidden(): boolean {
	try {
		return globalThis.localStorage?.getItem(HIDDEN_KEY) === '1';
	} catch {
		return false;
	}
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
	/** AppNav is on this page (not on game screens). */
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
		try {
			if (this.hidden) localStorage.setItem(HIDDEN_KEY, '1');
			else localStorage.removeItem(HIDDEN_KEY);
		} catch {
			// Storage blocked: the choice lasts for this visit.
		}
	}

	show(): void {
		this.open = true;
	}
}

export const navDrawer = new NavMenu();
