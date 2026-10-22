import { describe, expect, it } from 'vitest';
import { ACCOUNT_ITEM, isCurrent, NAV_ITEMS, NAV_SECTIONS, REPORTS_ITEM } from './nav.ts';

describe('navigation', () => {
	const scripts = NAV_ITEMS.find((item) => item.id === 'scripts')!;

	it('marks the item for its page and the pages under it', () => {
		expect(isCurrent(scripts, '/scripts')).toBe(true);
		expect(isCurrent(scripts, '/scripts/abc')).toBe(true);
		expect(isCurrent(scripts, '/scriptsx')).toBe(false);
		expect(isCurrent(scripts, '/')).toBe(false);
	});

	it('marks Home only on the landing page itself', () => {
		const home = NAV_ITEMS.find((item) => item.id === 'home')!;
		expect(isCurrent(home, '/')).toBe(true);
		expect(isCurrent(home, '/scripts')).toBe(false);
	});

	it('gives every destination its own icon (Trevor, 2026-10-16)', () => {
		const icons = [...NAV_ITEMS, ACCOUNT_ITEM, REPORTS_ITEM, { icon: 'settings' }].map(
			(item) => item.icon
		);
		expect(new Set(icons).size).toBe(icons.length);
	});

	it('lists each destination once', () => {
		const paths = NAV_ITEMS.map((item) => item.path);
		expect(new Set(paths).size).toBe(paths.length);
	});

	it('groups games first, then preparation (Trevor, 2026-10-16)', () => {
		expect(NAV_SECTIONS.map((section) => section.id)).toEqual(['games', 'prepare']);
		// Player view is reached from a join code, not the menu (Trevor, 2026-10-19).
		expect(NAV_ITEMS.some((item) => item.id === 'play')).toBe(false);
		expect(NAV_SECTIONS[0].items.map((item) => item.id)).toEqual([
			'new',
			'games',
			'join',
			'history'
		]);
	});

	it('puts Home first, outside the groups (Trevor, 2026-10-16)', () => {
		expect(NAV_ITEMS[0].id).toBe('home');
		expect(NAV_SECTIONS.some((s) => s.items.some((item) => item.id === 'home'))).toBe(false);
	});
});
