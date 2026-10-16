import type { MessageKey } from '#lib/i18n/catalog.ts';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

/**
 * The app's top-level destinations, in the left sidebar on wide screens and the menu drawer on
 * phones and in a game (Trevor, 2026-10-16: "reached from all parts of the app").
 */
export interface NavItem {
	id: string;
	path:
		| '/new'
		| '/games'
		| '/previous-games'
		| '/scripts'
		| '/play'
		| '/reference'
		| '/info-tokens'
		| '/account';
	label: MessageKey;
	icon: IconSlot;
}

/** A labelled group of destinations (Trevor, 2026-10-16: games, then pre-game preparation). */
export interface NavSection {
	id: 'games' | 'prepare' | 'players' | 'you';
	label: MessageKey;
	items: readonly NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
	{
		id: 'games',
		label: 'shell.navSectionGames',
		items: [
			{ id: 'new', path: '/new', label: 'shell.navNewGame', icon: 'add' },
			{ id: 'games', path: '/games', label: 'shell.navResumeGame', icon: 'history' },
			{
				id: 'previous',
				path: '/previous-games',
				label: 'shell.navPreviousGames',
				icon: 'history'
			}
		]
	},
	{
		id: 'prepare',
		label: 'shell.navSectionPrepare',
		items: [
			{ id: 'scripts', path: '/scripts', label: 'shell.navScripts', icon: 'script' },
			{ id: 'info-tokens', path: '/info-tokens', label: 'shell.navInfoTokens', icon: 'info' },
			{ id: 'reference', path: '/reference', label: 'shell.navReference', icon: 'reference' }
		]
	},
	{
		id: 'players',
		label: 'shell.navSectionPlayers',
		items: [{ id: 'play', path: '/play', label: 'shell.navPlayerView', icon: 'players' }]
	}
];

export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

/** The Account destination, listed with Settings under "You" at the end of the drawer. */
export const ACCOUNT_ITEM: NavItem = {
	id: 'account',
	path: '/account',
	label: 'shell.navAccount',
	icon: 'account'
};

/** The item a page belongs to: its own path or anything under it. */
export function isCurrent(item: NavItem, pathname: string): boolean {
	return pathname === item.path || pathname.startsWith(`${item.path}/`);
}
