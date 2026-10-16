import type { MessageKey } from '#lib/i18n/catalog.ts';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

/**
 * The app's top-level destinations, in the left sidebar on wide screens and the menu drawer on
 * phones and in a game (Trevor, 2026-10-16: "reached from all parts of the app").
 */
export interface NavItem {
	id: string;
	path: '/new' | '/games' | '/scripts' | '/play' | '/reference' | '/info-tokens' | '/account';
	label: MessageKey;
	icon: IconSlot;
}

export const NAV_ITEMS: readonly NavItem[] = [
	{ id: 'new', path: '/new', label: 'shell.navNewGame', icon: 'add' },
	{ id: 'games', path: '/games', label: 'shell.navResumeGame', icon: 'history' },
	{ id: 'scripts', path: '/scripts', label: 'shell.navScripts', icon: 'script' },
	{ id: 'play', path: '/play', label: 'shell.navPlayerView', icon: 'players' },
	{ id: 'reference', path: '/reference', label: 'shell.navReference', icon: 'reference' },
	{ id: 'info-tokens', path: '/info-tokens', label: 'shell.navInfoTokens', icon: 'info' }
];

/** The Account destination, listed with Settings at the end of the drawer. */
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
