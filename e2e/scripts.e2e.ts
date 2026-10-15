import { expect, test, type Page } from '@playwright/test';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';

const homebrew = [
	{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
	'washerwoman',
	'chef',
	{
		id: 'stormwarden',
		name: 'Storm Warden',
		team: 'townsfolk',
		ability: 'Each night, choose a player: they are safe from the Demon tonight.'
	},
	'saint',
	'poisoner',
	'imp'
];

const currentName = (page: Page) => page.getByTestId('current-script-name');

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('the home page links to Scripts', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Scripts' }).tap();
	await expect(page).toHaveURL(/\/scripts$/);
	await expect(page.getByRole('heading', { name: 'Scripts', level: 1 })).toBeVisible();
});

test('choosing an official edition makes it current and survives a reload', async ({ page }) => {
	await page.goto('/scripts');
	await expect(currentName(page)).toHaveText('None');
	await expect(page.getByTestId('recent-none')).toHaveText('None');
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await expect(currentName(page)).toHaveText('Trouble Brewing');
	await expect(page.getByTestId('current-script-counts')).toHaveText(
		'13 Townsfolk · 4 Outsiders · 4 Minions · 1 Demon'
	);
	await page.reload();
	await expect(currentName(page)).toHaveText('Trouble Brewing');
	await noSidewaysScroll(page);
});

test('a pasted script with a typo is checked, then loaded anyway', async ({ page }) => {
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Paste', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Paste a script' });
	await dialog
		.getByLabel('Script JSON or link')
		.fill(JSON.stringify([...homebrew, 'fortune_teler']));
	await dialog.getByRole('button', { name: 'Load' }).tap();

	const check = page.getByRole('dialog', { name: 'Script check' });
	await expect(check).toContainText('Not loaded');
	await expect(check).toContainText('Did you mean Fortune Teller');
	await check.getByRole('button', { name: 'Load anyway' }).tap();

	await expect(currentName(page)).toHaveText('Storm Front');
	await expect(page.getByTestId('current-script')).toContainText('Trevor');
	await expect(page.getByRole('button', { name: 'Storm Front Pasted' })).toBeVisible();
});

test('a script file loads straight away when nothing needs checking', async ({ page }) => {
	await page.goto('/scripts');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	await expect(currentName(page)).toHaveText('Storm Front');
	await expect(page.getByRole('dialog', { name: 'Script check' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Storm Front.*storm-front\.json/ })).toBeVisible();
});

test('a BotC Scripts number loads through our Worker', async ({ page }) => {
	await page.route('**/api/botcscripts/script/42', (route) =>
		route.fulfill({
			json: {
				scriptId: 42,
				versionId: 900,
				name: 'Storm Front',
				version: '1.2.0',
				author: 'Trevor',
				content: homebrew
			}
		})
	);
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'BotC Scripts' }).tap();
	const dialog = page.getByRole('dialog', { name: 'BotC Scripts' });
	await dialog.getByLabel('BotC Scripts link or script number').fill('42');
	await dialog.getByRole('button', { name: 'Load' }).tap();
	await expect(currentName(page)).toHaveText('Storm Front');
	await expect(page.getByRole('link', { name: 'BotC Scripts 1.2.0' })).toHaveAttribute(
		'href',
		'https://botcscripts.com/script/42/1.2.0'
	);
});

test('a link the browser may not read explains how to paste instead', async ({ page }) => {
	await page.route('https://scripts.example/blocked.json', (route) => route.abort('failed'));
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Link', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Load from a link' });
	const load = dialog.getByRole('button', { name: 'Load' });
	await dialog.getByLabel('Link to the script JSON').fill('https://scripts.example/blocked.json');
	await expect(dialog.getByRole('button', { name: 'Open link' })).toBeDisabled();
	const before = await load.boundingBox();
	await load.tap();
	await expect(dialog).toContainText('use Paste');
	await expect(dialog.getByRole('button', { name: 'Open link' })).toBeEnabled();
	// The error line is reserved, so the button does not move.
	expect(await load.boundingBox()).toEqual(before);
});

test('a share link opens its script and clears the hash', async ({ page }) => {
	await page.goto(`/scripts#s=${await encodeSharedScript(homebrew)}`);
	await expect(currentName(page)).toHaveText('Storm Front');
	await expect(page).toHaveURL(/\/scripts$/);
});
