import { gzipSync } from 'node:zlib';
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

/** The details beside the list (over it on a phone). */
const details = (page: Page) => page.getByRole('complementary', { name: 'Script details' });
const detailsName = (page: Page) => page.getByTestId('script-details-name');

/** Picks a source in the picker's Source dropdown. */
async function chooseSource(page: Page, label: string) {
	await page.getByRole('combobox', { name: 'Source' }).tap();
	await page.getByRole('option', { name: label }).tap();
}

/** Taps a row of the list, then Save in its details. */
async function pick(page: Page, name: string) {
	await page.getByRole('button', { name: new RegExp(`^${name}`) }).tap();
	await expect(detailsName(page)).toHaveText(name);
	await details(page).getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(details(page).getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('saved scripts are listed without the base three, survive a reload and can be removed', async ({
	page
}) => {
	await page.goto('/scripts');
	await expect(detailsName(page)).toHaveText('None');
	// The base three are always in New game, so the Scripts page leaves them out.
	await expect(page.getByTestId('picker-status')).toHaveText('None');
	await expect(page.getByRole('button', { name: /^Trouble Brewing/ })).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: 'Source' })).not.toContainText('Official');

	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	// Saving shows the script's details beside the list (over it on a phone), not in a modal.
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(details(page)).toBeVisible();
	await expect(page.getByTestId('script-characters')).toContainText('Storm Warden');
	await expect(details(page).getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
	await noSidewaysScroll(page);
	await backToList(page);
	await expect(details(page)).toBeVisible({ visible: test.info().project.name !== 'phone' });

	await page.reload();
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(page.getByTestId('picker-status')).toHaveText('1 script');

	// Remove from saved asks first.
	await page.getByRole('button', { name: /^Storm Front/ }).tap();
	await details(page).getByRole('button', { name: 'Remove from saved' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Remove from saved?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('picker-status')).toHaveText('None');
	await expect(detailsName(page)).toHaveText('None');
	await expect(details(page).getByRole('button', { name: 'Remove from saved' })).toBeDisabled();
});

/** Phones: the details cover the list until Back. */
async function backToList(page: Page) {
	const back = details(page).getByRole('button', { name: 'Back' });
	if (await back.isVisible()) await back.tap();
}

test('a pasted script with a typo is checked, then saved anyway', async ({ page }) => {
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Paste', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Paste a script' });
	await dialog
		.getByLabel('Script JSON or link')
		.fill(JSON.stringify([...homebrew, 'fortune_teler']));
	await dialog.getByRole('button', { name: 'Save' }).tap();

	const check = page.getByRole('dialog', { name: 'Script check' });
	await expect(check).toContainText('Not loaded');
	await expect(check).toContainText('Did you mean Fortune Teller');
	await check.getByRole('button', { name: 'Save anyway' }).tap();

	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(details(page)).toContainText('Trevor');
	await expect(page.getByRole('button', { name: 'Storm Front Pasted' })).toBeVisible();
});

test('a script file is saved straight away when nothing needs checking', async ({ page }) => {
	await page.goto('/scripts');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(page.getByRole('dialog', { name: 'Script check' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Storm Front.*storm-front\.json/ })).toBeVisible();
	// A load that worked needs no message (Trevor).
	await expect(page.getByText('Saved Storm Front', { exact: true })).toHaveCount(0);
});

test('a BotC Scripts number is saved through our Worker', async ({ page }) => {
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
	await chooseSource(page, 'BotC Scripts');
	await page.getByLabel('Search scripts').fill('42');
	await expect(page.getByTestId('picker-status')).toHaveText(
		'A BotC Scripts link or number: tap Save.'
	);
	await page.getByTestId('picker-more').getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(details(page).getByRole('link', { name: 'BotC Scripts 1.2.0' })).toHaveAttribute(
		'href',
		'https://botcscripts.com/script/42/1.2.0'
	);
});

test('a link the browser may not read explains how to paste instead', async ({ page }) => {
	await page.route('https://scripts.example/blocked.json', (route) => route.abort('failed'));
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Link', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Save from a link' });
	const load = dialog.getByRole('button', { name: 'Save' });
	await dialog.getByLabel('Link to the script JSON').fill('https://scripts.example/blocked.json');
	await expect(dialog.getByRole('button', { name: 'Open link' })).toBeDisabled();
	const before = await load.boundingBox();
	await load.tap();
	await expect(dialog).toContainText('use Paste');
	await expect(dialog.getByRole('button', { name: 'Open link' })).toBeEnabled();
	// The error line is reserved, so the button does not move.
	expect(await load.boundingBox()).toEqual(before);
});

test('a share link saves its script and clears the hash', async ({ page }) => {
	await page.goto(`/scripts#s=${await encodeSharedScript(homebrew)}`);
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(page).toHaveURL(/\/scripts$/);
});

test('a custom script gets a six-digit code that another phone can type in', async ({
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
	await expect(detailsName(page)).toHaveText('Storm Front');

	// One screen: QR code, link and code.
	await details(page).getByRole('button', { name: 'Share script' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Share Storm Front' });
	await expect(dialog.getByRole('img', { name: 'QR code for Storm Front' })).toBeVisible();
	const shown = dialog.getByTestId('share-digits');
	await expect(shown).toHaveText(/^\d{3} \d{3}$/);
	const code = (await shown.textContent())!;
	// One icon beside the link copies it; no success popup.
	await expect(dialog.getByRole('button', { name: 'Delete code' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Copy link' }).tap();
	await expect(page.getByText('Link copied')).toHaveCount(0);
	// The link opens the player view, with the script in the hash (never the query string).
	expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
		new RegExp(`^http://localhost:\\d+/play#c=${code.replace(' ', '')}$`)
	);
	await noSidewaysScroll(page);

	// Another phone types it in on the number pad.
	const other = await context.newPage();
	await other.goto('/scripts');
	await other.getByRole('button', { name: 'Code', exact: true }).tap();
	const entry = other.getByRole('dialog', { name: 'Have a code?' });
	const box = entry.getByLabel('The 6-digit code');
	await expect(box).toHaveAttribute('inputmode', 'numeric');
	const load = entry.getByRole('button', { name: 'Save' });
	await box.fill(code.slice(0, 5));
	await expect(load).toBeDisabled();
	await box.fill(code);
	await load.tap();
	await expect(other.getByTestId('script-details-name')).toHaveText('Storm Front');
	await noSidewaysScroll(other);
});

test('dropping a script file anywhere on the page saves it', async ({ page }) => {
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
	await expect(detailsName(page)).toHaveText('None');

	await drop('storm-front.json', 'application/json', JSON.stringify(homebrew));
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(page.getByTestId('drop-overlay')).not.toHaveClass(/active/);
});

test('BotC Scripts can be browsed, searched, sorted and filtered, then a result saved', async ({
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

	await page.route('**/api/curated', (route) => route.fulfill({ json: { scripts: [] } }));
	await page.goto('/scripts');
	// Searching the table first, then taking the search to BotC Scripts.
	await page.getByLabel('Search scripts').fill('storm');
	await expect(page.getByTestId('picker-status')).toHaveText('None');
	await page.getByLabel('Search scripts').fill('');
	await page.getByRole('button', { name: 'Search BotC Scripts' }).tap();
	const status = page.getByTestId('picker-status');
	await expect(status).toHaveText('2 scripts · most votes');
	const table = page.getByRole('table', { name: 'BotC Scripts results' });
	// The site's columns, with the characters counted from the script.
	const first = table.locator('tbody tr').first();
	await expect(first).toContainText('Most Voted One');
	await expect(first.locator('[data-col="characters"]')).toHaveText('7');
	await expect(first.locator('[data-col="likes"]')).toHaveText('5');
	await expect(table.getByRole('columnheader', { name: 'Likes' })).toHaveAttribute(
		'aria-sort',
		'descending'
	);
	await expect(page.getByRole('button', { name: 'More' })).toBeDisabled();

	await page.getByLabel('Search scripts').fill('storm');
	await expect(status).toHaveText('1 script · most votes');

	// Filters sit in the header row: Teensyville scripts with the Imp.
	await table.getByRole('button', { name: 'Filter Type', exact: true }).tap();
	await page.getByRole('dialog', { name: 'Filter Type' }).getByLabel('Teensyville').tap();
	await expect.poll(() => searches.at(-1)).toBe('?page=1&q=storm&type=Teensyville');
	await table.getByRole('button', { name: 'Filter Chars', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Filter Chars' })
		.getByRole('region', { name: 'Includes characters' })
		.getByRole('button', { name: 'Choose' })
		.tap();
	const picker = page.getByRole('dialog', { name: 'Includes' });
	await picker.getByRole('button', { name: 'Imp', exact: true }).tap();
	await picker.getByRole('button', { name: 'Done' }).tap();
	await expect.poll(() => searches.at(-1)).toBe('?page=1&q=storm&type=Teensyville&include=imp');
	await expect(table.getByRole('button', { name: 'Filter Chars (set)' })).toBeVisible();

	// Base three and Carousel, without Kickstarter.
	await table.getByRole('button', { name: 'Filter Chars (set)' }).tap();
	const chars = page.getByRole('dialog', { name: 'Filter Chars' });
	await expect(chars.getByTestId('filter-include')).toContainText('Imp');
	await chars.getByText('Kickstarter', { exact: true }).tap();
	await expect
		.poll(() => searches.at(-1))
		.toBe('?page=1&q=storm&type=Teensyville&include=imp&editions=base,carousel');
	await page.keyboard.press('Escape');
	// One request when BotC Scripts was chosen, one after typing paused, one per filter.
	expect(searches).toEqual([
		'?page=1',
		'?page=1&q=storm',
		'?page=1&q=storm&type=Teensyville',
		'?page=1&q=storm&type=Teensyville&include=imp',
		'?page=1&q=storm&type=Teensyville&include=imp&editions=base,carousel'
	]);

	// Likes, then (with a search) the closest names.
	await table.getByRole('columnheader', { name: 'Likes' }).getByRole('button').tap();
	await expect.poll(() => searches.at(-1)).toContain('&sort=match');
	await expect(status).toHaveText('1 script · best match');

	// Tapping a result shows its characters beside the list, no modal; nothing saves until Save.
	await expect(detailsName(page)).toHaveText('None');
	await table.getByRole('button', { name: /^Storm Front/ }).tap();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(page.getByTestId('script-characters')).toContainText('Storm Warden');
	await expect(page.getByTestId('script-characters')).toContainText('Imp');
	await expect(details(page).getByRole('link', { name: 'BotC Scripts 1.0.0' })).toHaveAttribute(
		'href',
		'https://botcscripts.com/script/1900/1.0.0'
	);
	await details(page).getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(details(page).getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
	await expect(detailsName(page)).toHaveText('Storm Front');
	await noSidewaysScroll(page);
});

/** A Script Tool link, built the way TPI's Script Tool builds them. */
function scriptToolLink(script: unknown[]): string {
	const payload = gzipSync(Buffer.from(JSON.stringify(script))).toString('base64');
	return `https://script.bloodontheclocktower.com/?script=${encodeURIComponent(payload)}`;
}

const teensy = [
	{ id: '_meta', name: 'Little Hamlet', author: 'Someone Small' },
	'chef',
	'empath',
	'investigator',
	'librarian',
	'monk',
	'saint',
	'recluse',
	'poisoner',
	'spy',
	'imp'
];

// Every Trouble Brewing character: a full-size script.
const bigTown = [
	{ id: '_meta', name: 'Big Town', author: 'Someone Big' },
	...['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller'],
	...['undertaker', 'monk', 'ravenkeeper', 'virgin', 'slayer', 'soldier', 'mayor'],
	...['butler', 'drunk', 'recluse', 'saint', 'poisoner', 'spy', 'scarletwoman', 'baron', 'imp']
];

test("the official site's curated scripts are listed when asked for, and saved", async ({
	page
}) => {
	let asked = 0;
	await page.route('**/api/curated', (route) => {
		asked++;
		return route.fulfill({
			json: {
				scripts: [
					{ section: 'teensyville', link: scriptToolLink(teensy), json: teensy },
					{ section: 'recommended', link: scriptToolLink(bigTown), json: bigTown }
				]
			}
		});
	});
	await page.goto('/scripts');
	await expect(page.getByTestId('picker-status')).toHaveText('None');
	// Nothing is fetched from the official site until its scripts are wanted.
	expect(asked).toBe(0);

	await chooseSource(page, 'Curated (official site)');
	await expect(page.getByTestId('picker-status')).toHaveText('2 scripts');
	expect(asked).toBe(1);
	const table = page.getByRole('table', { name: 'Scripts' });
	await expect(table).toContainText('Little Hamlet');
	await expect(table).toContainText('Teensyville');

	// Sorting by name, then the other way round.
	const name = table.getByRole('columnheader', { name: 'Name' });
	await name.getByRole('button', { name: /^Name/ }).tap();
	await expect(name).toHaveAttribute('aria-sort', 'ascending');
	await expect(table.locator('tbody tr').first()).toContainText('Big Town');
	await name.getByRole('button', { name: /^Name/ }).tap();
	await expect(name).toHaveAttribute('aria-sort', 'descending');
	await expect(table.locator('tbody tr').first()).toContainText('Little Hamlet');

	// Teensyville only, from the funnel in the header row. On phones the Type column is
	// hidden and its funnel sits beside Name, labelled so moved funnels can be told apart.
	const typeFilter = table.getByRole('button', { name: 'Filter Type', exact: true });
	if (test.info().project.name === 'phone') await expect(typeFilter).toHaveText('Type');
	await typeFilter.tap();
	await page.getByRole('dialog', { name: 'Filter Type' }).getByLabel('Teensyville').tap();
	await expect(page.getByTestId('picker-status')).toHaveText('1 script');

	await pick(page, 'Little Hamlet');
	await expect(detailsName(page)).toHaveText('Little Hamlet');
	await expect(details(page)).toContainText('Script Tool');
	await noSidewaysScroll(page);
});

test('a Script Tool link is read from the link itself, with no request', async ({ page }) => {
	const requests: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('bloodontheclocktower.com')) requests.push(r.url());
	});
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Link', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Save from a link' });
	await dialog.getByLabel('Link to the script JSON').fill(scriptToolLink(teensy));
	await dialog.getByRole('button', { name: 'Save' }).tap();
	await expect(detailsName(page)).toHaveText('Little Hamlet');
	expect(requests).toEqual([]);
});
