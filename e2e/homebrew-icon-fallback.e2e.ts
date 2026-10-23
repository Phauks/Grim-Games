import { expect, test } from '@playwright/test';

// A homebrew character whose image won't load (a dead link, or offline) shows TPI's generic
// icon for its type instead of a broken image (Trevor, 2026-10-19).
test('a homebrew image that fails to load falls back to the generic icon', async ({ page }) => {
	await page.route('https://images.example.test/**', (route) => route.abort());
	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'dead-link.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([
				{ id: '_meta', name: 'Dead Link', author: 'Trevor' },
				'chef',
				{
					id: 'lamplighter',
					name: 'Lamplighter',
					team: 'townsfolk',
					ability: 'Each night, learn something.',
					image: 'https://images.example.test/lamplighter.png'
				},
				'imp'
			])
		)
	});
	await expect(page.getByTestId('script-details-name')).toHaveText('Dead Link');
	await page.goto('/play');
	const row = page.locator('[data-character="lamplighter"]');
	await expect(row.getByRole('button', { name: /Lamplighter/ }).locator('img')).toHaveAttribute(
		'src',
		/\/data\/icons\/generic\/townsfolk_g\.webp$/
	);
});

// Trevor, 2026-10-23: High Seas of Mutiny (https://www.botchomebrew.wiki/s/high-seas-of-mutiny)
// showed no icons of its own. Its images are on the HomeBrew Wiki (`/assets/art/<slug>.png`),
// which, like many image hosts, refuses an image asked for from another site's page. Icons are
// asked for with no referrer, as script logos already are.
test('a homebrew image from a host that blocks hotlinking still loads', async ({ page }) => {
	const PNG = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64'
	);
	const referrers: (string | undefined)[] = [];
	await page.route('https://botchomebrew.wiki/assets/art/**', (route) => {
		const referrer = route.request().headers()['referer'];
		referrers.push(referrer);
		return referrer
			? route.fulfill({ status: 403 })
			: route.fulfill({ contentType: 'image/png', body: PNG });
	});
	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'high-seas.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([
				{ id: '_meta', name: 'Hotlink Test', author: 'Trevor' },
				'chef',
				{
					id: 'oldseadog',
					name: 'Old Seadog',
					team: 'townsfolk',
					ability: 'Each night, learn something.',
					image: ['https://botchomebrew.wiki/assets/art/old-seadog.png']
				},
				'imp'
			])
		)
	});
	await expect(page.getByTestId('script-details-name')).toHaveText('Hotlink Test');
	await page.goto('/play');
	const icon = page
		.locator('[data-character="oldseadog"]')
		.getByRole('button', { name: /Old Seadog/ })
		.locator('img');
	await expect(icon).toHaveAttribute('src', 'https://botchomebrew.wiki/assets/art/old-seadog.png');
	await expect.poll(() => icon.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
	expect(referrers.length).toBeGreaterThan(0);
	expect(referrers.every((r) => !r)).toBe(true);
});
