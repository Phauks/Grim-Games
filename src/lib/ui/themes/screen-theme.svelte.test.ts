import { describe, expect, it } from 'vitest';
import { THEMES } from './registry.ts';
import { screenTheme } from './screen-theme.svelte.ts';
import { sheetTheme } from './sheet-backgrounds.ts';

describe('screenTheme.show', () => {
	it("leaves a newer screen's theme in place when the older screen goes", () => {
		const base = THEMES[0]!;
		// Moving between two player screens sets up the new one before the old one goes.
		const leaveOld = screenTheme.show(sheetTheme('parchment', base));
		const newer = sheetTheme('parchment', base);
		const leaveNew = screenTheme.show(newer);
		leaveOld();
		expect(screenTheme.current).toBe(newer);
		leaveNew();
		expect(screenTheme.current).toBeUndefined();
	});

	it("leaves a newer screen's theme in place after a screen in the app's own colours", () => {
		// A screen in the Theme sheet background shows no colours of its own.
		const leave = screenTheme.show(undefined);
		const later = screenTheme.show(sheetTheme('slate', THEMES[0]!));
		leave();
		expect(screenTheme.current?.id).toBe('grimoire-slate');
		later();
		expect(screenTheme.current).toBeUndefined();
	});
});
