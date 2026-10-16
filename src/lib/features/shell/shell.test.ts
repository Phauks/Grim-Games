import { describe, expect, it } from 'vitest';
import { showsAppShell } from './shell.ts';

describe('showsAppShell', () => {
	it("hides the header and footer only where the route's data says it is a game", () => {
		expect(showsAppShell({ chrome: 'game' })).toBe(false);
		expect(showsAppShell({ chrome: 'app' })).toBe(true);
		expect(showsAppShell({})).toBe(true);
		expect(showsAppShell(null)).toBe(true);
	});
});
