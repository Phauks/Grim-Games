import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A join, view-only or recap QR code opens the installed app on Android instead of the browser
 * when its link is inside the manifest's scope: Chrome hands in-scope links to the installed
 * app (web.dev, "Handle links in your PWA"; Trevor, 2026-10-20). iOS has no such link capture
 * (platform gaps list, /mnt/project-files/platform-gaps.md).
 */
const manifest = JSON.parse(
	readFileSync(new URL('../static/manifest.webmanifest', import.meta.url), 'utf8')
) as { scope: string; start_url: string; id: string };

describe('web app manifest', () => {
	it.each(['/join/ABCD', '/watch/ABCD', '/play', '/recap/abc'])(
		'covers %s, so its QR code can open the installed app',
		(path) => {
			expect(path.startsWith(manifest.scope)).toBe(true);
		}
	);

	it('starts inside its own scope, with a fixed id so reinstalling keeps the same app', () => {
		expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
		expect(manifest.id).toBe('/');
	});
});
