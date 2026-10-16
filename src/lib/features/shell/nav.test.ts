import { describe, expect, it } from 'vitest';
import { isCurrent, NAV_ITEMS } from './nav.ts';

describe('navigation', () => {
	const scripts = NAV_ITEMS.find((item) => item.id === 'scripts')!;

	it('marks the item for its page and the pages under it', () => {
		expect(isCurrent(scripts, '/scripts')).toBe(true);
		expect(isCurrent(scripts, '/scripts/abc')).toBe(true);
		expect(isCurrent(scripts, '/scriptsx')).toBe(false);
		expect(isCurrent(scripts, '/')).toBe(false);
	});

	it('lists each destination once', () => {
		const paths = NAV_ITEMS.map((item) => item.path);
		expect(new Set(paths).size).toBe(paths.length);
	});
});
