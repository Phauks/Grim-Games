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
	// A load that worked needs no message (Trevor).
	await expect(page.getByText('Loaded Storm Front')).toHaveCount(0);
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
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({ json: { page: 1, count: 0, hasMore: false, results: [] } })
	);
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'BotC Scripts' }).tap();
	const dialog = page.getByRole('dialog', { name: 'BotC Scripts' });
	await dialog.getByLabel('Search, link or script number').fill('42');
	await expect(dialog.getByTestId('botc-status')).toHaveText(
		'A BotC Scripts link or number: tap Load.'
	);
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
	await page.goto('/scripts#e=bmr');
	await expect(currentName(page)).toHaveText('Bad Moon Rising');
	await expect(page).toHaveURL(/\/scripts$/);
});

test('an official script is shared on one screen: QR code, link and code', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/scripts');
	const share = page.getByRole('button', { name: 'Share script' });
	await expect(share).toBeDisabled();
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await expect(currentName(page)).toHaveText('Trouble Brewing');

	await share.tap();
	const dialog = page.getByRole('dialog', { name: 'Share Trouble Brewing' });
	await expect(dialog.getByRole('img', { name: 'QR code for Trouble Brewing' })).toBeVisible();
	await expect(dialog.getByTestId('share-url')).toHaveValue(/\/play#e=tb$/);
	// Official scripts need no stored code: the link names the edition.
	await expect(dialog.getByTestId('share-code')).toHaveText(/^\s*Code\s*None\s*$/);
	await expect(dialog.getByRole('button', { name: 'Delete code' })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Copy link' }).tap();
	const link = await page.evaluate(() => navigator.clipboard.readText());
	// The link opens the player view, with the script in the hash (never the query string).
	expect(link).toMatch(/^http:\/\/localhost:\d+\/play#e=tb$/);
	await noSidewaysScroll(page);
});

test('a custom script gets a six-digit code that another phone can type in, until it is deleted', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/scripts');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	await expect(currentName(page)).toHaveText('Storm Front');

	await page.getByRole('button', { name: 'Share script' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Share Storm Front' });
	await expect(dialog.getByRole('img', { name: 'QR code for Storm Front' })).toBeVisible();
	const shown = dialog.getByTestId('share-digits');
	await expect(shown).toHaveText(/^\d{3} \d{3}$/);
	const code = (await shown.textContent())!;
	await dialog.getByRole('button', { name: 'Copy link' }).tap();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
		new RegExp(`/play#c=${code.replace(' ', '')}$`)
	);

	// Another phone types it in on the number pad.
	const other = await context.newPage();
	await other.goto('/scripts');
	await other.getByRole('button', { name: 'Code', exact: true }).tap();
	const entry = other.getByRole('dialog', { name: 'Have a code?' });
	const box = entry.getByLabel('The 6-digit code');
	await expect(box).toHaveAttribute('inputmode', 'numeric');
	const load = entry.getByRole('button', { name: 'Load' });
	await box.fill(code.slice(0, 5));
	await expect(load).toBeDisabled();
	await box.fill(code);
	await load.tap();
	await expect(other.getByTestId('current-script-name')).toHaveText('Storm Front');

	// The sharer deletes the code; it no longer loads.
	await dialog.getByRole('button', { name: 'Delete code' }).tap();
	await expect(dialog).toBeHidden();
	await other.getByRole('button', { name: 'Code', exact: true }).tap();
	await entry.getByLabel('The 6-digit code').fill(code);
	await entry.getByLabel('The 6-digit code').press('Enter');
	await expect(entry.getByRole('status')).toHaveText(/No script has this code/);
	await noSidewaysScroll(other);
});

test('dropping a script file anywhere on the page loads it', async ({ page }) => {
	await page.goto('/scripts');
	const drop = async (name: string, type: string, body: string) => {
		const data = await page.evaluateHandle(
			({ name, type, body }) => {
				const transfer = new DataTransfer();
				transfer.items.add(new File([body], name, { type }));
				return transfer;
			},
			{ name, type, body }
		);
		await page.dispatchEvent('main', 'dragenter', { dataTransfer: data });
		await expect(page.getByTestId('drop-overlay')).toHaveClass(/active/);
		await page.dispatchEvent('main', 'drop', { dataTransfer: data });
	};

	await drop('photo.png', 'image/png', 'not a script');
	await expect(page.getByTestId('file-error')).toHaveText(
		'photo.png is not a script. Scripts are .json files.'
	);
	await expect(currentName(page)).toHaveText('None');

	await drop('storm-front.json', 'application/json', JSON.stringify(homebrew));
	await expect(currentName(page)).toHaveText('Storm Front');
	await expect(page.getByTestId('drop-overlay')).not.toHaveClass(/active/);
});

test('BotC Scripts can be browsed, searched, sorted and filtered, then a result loaded', async ({
	page
}) => {
	const searches: string[] = [];
	const row = (versionId: number, name: string, characters: object[]) => ({
		scriptId: versionId + 1000,
		versionId,
		name,
		version: '1.0.0',
		author: 'Someone',
		type: 'Full',
		score: 5,
		characters
	});
	const tb = ['washerwoman', 'chef', 'empath', 'drunk', 'saint', 'poisoner', 'imp'].map((id) => ({
		id
	}));
	await page.route(/\/api\/botcscripts\/search\?/, (route) => {
		const url = new URL(route.request().url());
		searches.push(decodeURIComponent(url.search));
		const results = url.searchParams.get('q')
			? [
					row(900, 'Storm Front', [
						...tb,
						{ id: 'stormwarden', name: 'Storm Warden', team: 'townsfolk' }
					])
				]
			: [row(1, 'Most Voted One', tb), row(2, 'Most Voted Two', tb)];
		return route.fulfill({ json: { page: 1, count: results.length, hasMore: false, results } });
	});
	await page.route('**/api/botcscripts/version/900', (route) =>
		route.fulfill({
			json: {
				scriptId: 1900,
				versionId: 900,
				name: 'Storm Front',
				version: '1.0.0',
				author: 'Trevor',
				content: homebrew
			}
		})
	);

	await page.goto('/scripts');
	await page.getByRole('button', { name: 'BotC Scripts' }).tap();
	const dialog = page.getByRole('dialog', { name: 'BotC Scripts' });
	const status = dialog.getByTestId('botc-status');
	await expect(status).toHaveText('2 scripts · most votes');
	// Each card counts the script's characters and names its Demons.
	await expect(dialog.getByTestId('botc-makeup').first()).toContainText('3 · 2 · 1 · 1');
	await expect(dialog.getByTestId('botc-makeup').first()).toContainText('Imp');
	await expect(dialog.getByRole('button', { name: 'More' })).toBeDisabled();

	await dialog.getByLabel('Search, link or script number').fill('storm');
	await expect(status).toHaveText('1 script · most votes');
	await expect(dialog.getByTestId('botc-makeup').first()).toContainText('Homebrew');

	// Filters: Teensyville scripts with the Imp.
	await dialog.getByRole('button', { name: 'Filters' }).tap();
	const filters = page.getByRole('dialog', { name: 'Filters' });
	await filters.getByRole('button', { name: 'Teensyville' }).tap();
	await filters
		.getByRole('region', { name: 'Includes characters' })
		.getByRole('button', { name: 'Choose' })
		.tap();
	const picker = page.getByRole('dialog', { name: 'Includes' });
	await picker.getByRole('button', { name: 'Imp', exact: true }).tap();
	await picker.getByRole('button', { name: 'Done' }).tap();
	await expect(filters.getByTestId('filter-include')).toContainText('Imp');
	await filters.getByRole('button', { name: 'Show scripts' }).tap();
	await expect(dialog.getByRole('button', { name: 'Filters · 2' })).toBeVisible();
	await expect.poll(() => searches.at(-1)).toBe('?page=1&q=storm&type=Teensyville&include=imp');
	// One request when the dialog opened, one after typing paused, one for the filters.
	expect(searches).toEqual([
		'?page=1',
		'?page=1&q=storm',
		'?page=1&q=storm&type=Teensyville&include=imp'
	]);

	// Details, then load from there.
	await dialog.getByRole('button', { name: 'Details of Storm Front' }).tap();
	const details = page.getByRole('dialog', { name: 'Storm Front' });
	await expect(details).toContainText('Storm Warden');
	await expect(details.getByRole('link', { name: 'Open on BotC Scripts' })).toHaveAttribute(
		'href',
		'https://botcscripts.com/script/1900/1.0.0'
	);
	await details.getByRole('button', { name: 'Load' }).tap();
	await expect(currentName(page)).toHaveText('Storm Front');
	await noSidewaysScroll(page);
});
