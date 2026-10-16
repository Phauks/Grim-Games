import { describe, expect, it } from 'vitest';
import { isCurrent, NAV_ITEMS, NAV_SECTIONS } from './nav.ts';

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

	it('lists each destination once', () => {
		const paths = NAV_ITEMS.map((item) => item.path);
		expect(new Set(paths).size).toBe(paths.length);
	});

	it('groups games first, then preparation, then players (Trevor, 2026-10-16)', () => {
		expect(NAV_SECTIONS.map((section) => section.id)).toEqual(['games', 'prepare', 'players']);
		expect(NAV_SECTIONS[0].items.map((item) => item.id)).toEqual([
			'home',
			'new',
			'games',
			'previous'
		]);
	});
});
