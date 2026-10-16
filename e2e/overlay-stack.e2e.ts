import { expect, test } from '@playwright/test';

// Overlays stack in the order they were opened (Trevor, 2026-10-16), whatever order their
// components mounted in: the Glossary dialog lives in the root layout, so it used to open
// underneath character details.
test('the Glossary opened from character details shows above them, and closes back to them', async ({
	page
}) => {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({ json: { parse: { text: '<p><b>Once per game:</b> Sample wording.</p>' } } })
	);
	await page.goto('/spikes/day');
	await page
		.getByRole('radiogroup', { name: 'Sample game' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page
		.getByRole('region', { name: 'Today' })
		.getByRole('button', { name: /^Slayer/ })
		.first()
		.tap();
	const details = page.getByRole('dialog', { name: 'Slayer' });
	await details.getByRole('button', { name: 'once per game: explain rules term' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Once per game' })
		.getByRole('button', { name: 'Open Glossary' })
		.tap();

	const glossary = page.getByRole('dialog', { name: 'Glossary' });
	await expect(glossary).toBeVisible();
	// On top: the point at the middle of the screen belongs to the Glossary, not the details.
	const onTop = await page.evaluate(() => {
		const contents = [...document.querySelectorAll('[data-scope="dialog"][data-part="content"]')];
		const z = (el: Element) => Number(getComputedStyle(el.parentElement!).zIndex);
		const titled = (name: string) =>
			contents.find((el) => el.querySelector('[data-part="title"]')?.textContent === name)!;
		return z(titled('Glossary')) > z(titled('Slayer'));
	});
	expect(onTop).toBe(true);

	// Its own Close is reachable (nothing covers it) and returns to the details.
	await glossary.getByRole('button', { name: 'Close', exact: true }).tap();
	await expect(glossary).toBeHidden();
	await expect(details).toBeVisible();

	// Opened again, Escape closes only the top one.
	await details.getByRole('button', { name: 'once per game: explain rules term' }).first().tap();
	await page
		.getByRole('dialog', { name: 'Once per game' })
		.getByRole('button', { name: 'Open Glossary' })
		.tap();
	await expect(glossary).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(glossary).toBeHidden();
	await expect(details).toBeVisible();
});
