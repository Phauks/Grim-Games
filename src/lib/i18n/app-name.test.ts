import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '#lib/core/app-name.ts';

// The two files that can't import APP_NAME must still say it (Trevor, 2026-10-18).
describe('the app name', () => {
	it('is the installed app name in the manifest', () => {
		const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8'));
		expect(manifest.name).toBe(APP_NAME);
		expect(manifest.short_name).toBe(APP_NAME);
	});

	it('is in the start-up failure screen', () => {
		expect(readFileSync('src/app.html', 'utf8')).toContain(`"${APP_NAME} couldn't start"`);
	});
});
