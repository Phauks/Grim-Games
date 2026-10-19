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
