import type { MessageKey } from '#lib/i18n/catalog.ts';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

/**
 * The app's top-level destinations, in the left sidebar on wide screens and the menu drawer on
 * phones and in a game (Trevor, 2026-10-16: "reached from all parts of the app").
 */
export interface NavItem {
	id: string;
	path:
		| '/'
		| '/new'
		| '/join'
		| '/history'
		| '/scripts'
		| '/library'
		| '/build-script'
		| '/build-character'
		| '/build-mode'
		| '/reference'
		| '/info-tokens'
		| '/account'
		| '/friends'
		| '/reports'
		| '/live-games'
		| '/test-room'
		| '/accounts'
		| '/about'
		| '/credits'
		| '/support'
		| '/changelog'
		| '/roadmap'
		| '/privacy';
	label: MessageKey;
	icon: IconSlot;
}

/** A labelled group of destinations (Trevor, 2026-10-16: games, then pre-game preparation). */
export interface NavSection {
	id: 'games' | 'prepare' | 'you';
	label: MessageKey;
	items: readonly NavItem[];
}

/** The landing page, reachable without Back; first, outside any group (Trevor, 2026-10-16). */
export const HOME_ITEM: NavItem = { id: 'home', path: '/', label: 'shell.navHome', icon: 'home' };

export const NAV_SECTIONS: readonly NavSection[] = [
	{
		id: 'games',
		label: 'shell.navSectionGames',
		items: [
			{ id: 'new', path: '/new', label: 'shell.navNewGame', icon: 'add' },
			// Typing a room code, and the games this device is in: rooms joined as a player above games
			// it is storytelling (Trevor, 2026-10-18 and 2026-10-28).
			{ id: 'join', path: '/join', label: 'shell.navJoinGame', icon: 'join' }
			// History is under "You", beside Friends (Trevor, 2026-10-29).
		]
	},
	{
		id: 'prepare',
		label: 'shell.navSectionPrepare',
		items: [
			{ id: 'scripts', path: '/scripts', label: 'shell.navScripts', icon: 'search' },
			// Everything the user has saved or made (Trevor, 2026-10-16).
			{ id: 'library', path: '/library', label: 'shell.navLibrary', icon: 'library' },
			{
				id: 'build-script',
				path: '/build-script',
				label: 'shell.navBuildScript',
				icon: 'buildScript'
			},
			{
				id: 'build-character',
				path: '/build-character',
				label: 'shell.navBuildCharacter',
				icon: 'buildCharacter'
			},
			{
				id: 'build-mode',
				path: '/build-mode',
				label: 'shell.navBuildMode',
				icon: 'buildMode'
			},
			{ id: 'info-tokens', path: '/info-tokens', label: 'shell.navInfoTokens', icon: 'info' },
			{ id: 'reference', path: '/reference', label: 'shell.navReference', icon: 'reference' }
		]
	}
	// No Player view (Trevor, 2026-10-19): the Storyteller has the board's Script, and a player
	// gets there from a room's join code or a shared script link.
];

export const NAV_ITEMS: readonly NavItem[] = [
	HOME_ITEM,
	...NAV_SECTIONS.flatMap((section) => section.items)
];

/** The games played on this device, under "You" after Friends (Trevor, 2026-10-29). */
export const HISTORY_ITEM: NavItem = {
	id: 'history',
	path: '/history',
	label: 'shell.navHistory',
	icon: 'history'
};

/** The Account destination, listed with Settings under "You" at the end of the drawer. */
export const ACCOUNT_ITEM: NavItem = {
	id: 'account',
	path: '/account',
	label: 'shell.navAccount',
	icon: 'account'
};

/** Friends (plan F1), under Account in "You" (Trevor, 2026-10-29: "a new friends tab"). */
export const FRIENDS_ITEM: NavItem = {
	id: 'friends',
	path: '/friends',
	label: 'shell.navFriends',
	icon: 'friends'
};

/**
 * The reports inbox, in its own "Admin" group, shown only to admin accounts (Trevor,
 * 2026-10-18); everyone else never sees it, so it is left out rather than disabled.
 */
export const REPORTS_ITEM: NavItem = {
	id: 'reports',
	path: '/reports',
	label: 'shell.navReports',
	icon: 'report'
};

/** Every open room, to watch unseen (plan J31); in the Admin group, for admins only. */
export const LIVE_GAMES_ITEM: NavItem = {
	id: 'live-games',
	path: '/live-games',
	label: 'shell.navLiveGames',
	icon: 'watchers'
};

/**
 * Phone-sized frames of the app and bots in one live room, to try a game at every size (Trevor,
 * 2026-10-30); in the Admin group, for admins only.
 */
export const TEST_ROOM_ITEM: NavItem = {
	id: 'test-room',
	path: '/test-room',
	label: 'shell.navTestRoom',
	icon: 'phoneHere'
};

/** Find one account and act on it (plan S27); in the Admin group, for admins only. */
export const ACCOUNTS_ITEM: NavItem = {
	id: 'accounts',
	path: '/accounts',
	label: 'shell.navAccounts',
	icon: 'accounts'
};

/**
 * The app's own pages, under "App" after You: what the footer held before it went (2026-10-23).
 * Report an issue follows them as a button (NavList), and the build line under that.
 */
export const APP_ITEMS: readonly NavItem[] = [
	{ id: 'about', path: '/about', label: 'shell.about', icon: 'about' },
	// Its own page, out of About (Trevor, 2026-10-28).
	{ id: 'credits', path: '/credits', label: 'shell.credits', icon: 'credits' },
	// Beneath About (Trevor, 2026-10-26).
	{ id: 'support', path: '/support', label: 'shell.support', icon: 'support' },
	{ id: 'changelog', path: '/changelog', label: 'shell.changelog', icon: 'notes' },
	{ id: 'roadmap', path: '/roadmap', label: 'shell.roadmap', icon: 'forward' },
	{ id: 'privacy', path: '/privacy', label: 'shell.privacy', icon: 'lock' }
];

/** The item a page belongs to: its own path or anything under it. */
export function isCurrent(item: NavItem, pathname: string): boolean {
	if (item.path === '/') return pathname === '/';
	return pathname === item.path || pathname.startsWith(`${item.path}/`);
}
