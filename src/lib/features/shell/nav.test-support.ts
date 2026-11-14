import { HOME_ITEM, NAV_SECTIONS, type NavItem } from './nav.ts';

/** Every destination in the drawer, Home first. */
export const NAV_ITEMS: readonly NavItem[] = [
	HOME_ITEM,
	...NAV_SECTIONS.flatMap((section) => section.items)
];
