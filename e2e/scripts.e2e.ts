import { gzipSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';
import { WORLD_CUPS } from '../src/lib/features/scripts/world-cup.ts';

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

/** The sources menu beside the title (Trevor, 2026-10-18): any sources, on or off. */
const sourcePicker = (page: Page) => page.getByRole('button', { name: /^Sources:/ });
const sourceMenu = (page: Page) => page.getByTestId('search-sources');
const SOURCE_NAMES = [
	'BotC Scripts',
	'BOTC HomeBrew Wiki',
	'Bloodstar Clocktica',
	'Official custom scripts',
	'Scripts of the Month',
	'Carousel Script Collection',
	'World Cup 2023',
	'World Cup 2025'
];
/** Opens the sources menu with both groups open. */
async function openSources(page: Page) {
	await sourcePicker(page).tap();
	for (const group of ['Search engines', 'Collections']) {
		await sourceMenu(page).getByRole('button', { name: group, exact: true }).tap();
	}
}
/** Turns every source off but one, without turning the others on on the way. */
async function chooseSource(page: Page, label: string) {
	await openSources(page);
	const menu = sourceMenu(page);
	for (const name of SOURCE_NAMES) {
		const on = await menu.getByRole('checkbox', { name, exact: true }).isChecked();
		if (on !== (name === label)) await menu.getByText(name, { exact: true }).tap();
	}
	await page.keyboard.press('Escape');
	await expect(sourcePicker(page)).toHaveAccessibleName(`Sources: ${label}`);
}

// Every source answers empty; tests that need results route these again.
test.beforeEach(async ({ page }) => {
	// Most tests search BotC Scripts alone; `e2e:app-sources` keeps the app's own default.
	await page.addInitScript(() => {
		if (localStorage.getItem('e2e:app-sources')) return;
		if (!localStorage.getItem('grim-games:scripts:sources')) {
			localStorage.setItem('grim-games:scripts:sources', JSON.stringify(['botc']));
		}
	});
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({ json: { page: 1, count: 0, hasMore: false, results: [] } })
	);
	await page.route('**/api/curated', (route) => route.fulfill({ json: { scripts: [] } }));
	await page.route('**/api/collections/*', (route) => route.fulfill({ json: { scripts: [] } }));
	await page.route('**/api/homebrew-scripts', (route) => route.fulfill({ json: { scripts: [] } }));
	await page.route('**/api/bloodstar', (route) => route.fulfill({ json: { scripts: [] } }));
	await page.route('**/api/world-cups/*', (route) => route.fulfill({ json: { scripts: [] } }));
});

/**
 * Add script lives in the Library (Trevor, 2026-10-17: what the user added); Search only
 * finds scripts. Opens the Library, then Add script's one dialog (link, JSON and file).
 */
async function addScript(page: Page) {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
}

/** Taps a row of the list, then Save in its details. */
async function pick(page: Page, name: string) {
	await page.getByRole('button', { name: new RegExp(`^${name}`) }).tap();
	await expect(detailsName(page)).toHaveText(name);
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
}

/** Saves a script file from the Library, then opens Search, which shows the latest saved. */
async function uploadThenSearch(page: Page, script: unknown[], mimeType = 'application/json') {
	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType,
		buffer: Buffer.from(JSON.stringify(script))
	});
	await expect(page.getByTestId('script-details-name')).toHaveText(
		(script[0] as { name: string }).name
	);
	await page.goto('/scripts');
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('Search finds scripts: saved ones stay in the Library, off its list', async ({ page }) => {
	await page.goto('/scripts');
	await expect(detailsName(page)).toHaveText('None');
	// BotC Scripts is listed first; the base three are always in New game, so never here.
	await expect(sourcePicker(page)).toContainText('BotC Scripts');
	await expect(page.getByTestId('picker-status')).toHaveText('None');
	await expect(page.getByRole('button', { name: /^Trouble Brewing/ })).toHaveCount(0);
	// Adding scripts is the Library's (Trevor, 2026-10-17).
	await expect(page.getByRole('button', { name: 'Add script' })).toHaveCount(0);

	await uploadThenSearch(page, homebrew);
	await expect(page.getByTestId('picker-status')).toHaveText('None');
	await page.reload();
	await expect(page.getByTestId('picker-status')).toHaveText('None');
});

test('Save is one toggle: un-saving asks first, and the script stays shown', async ({ page }) => {
	await page.route('**/api/curated', (route) =>
		route.fulfill({
			json: {
				scripts: [{ section: 'recommended', link: scriptToolLink(homebrew), json: homebrew }]
			}
		})
	);
	await page.goto('/scripts');
	await chooseSource(page, 'Official custom scripts');
	await page.getByRole('button', { name: /^Storm Front/ }).tap();
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(details(page)).toBeVisible();
	// The details show the script as players see it: names and abilities by type (Trevor).
	const sheet = page.getByTestId('script-sheet');
	await expect(sheet).toContainText('Storm Warden');
	await expect(sheet).toContainText('they are safe from the Demon tonight');
	await expect(sheet.getByRole('button', { name: 'Townsfolk', exact: true })).toBeVisible();
	// Its source stays Official, saved or not: the Save toggle shows it is saved (Trevor,
	// 2026-10-19).
	const rows = page.getByRole('row').filter({ hasText: 'Storm Front' });
	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText('Official');
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'false');
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText('Official');
	await expect(rows).not.toContainText('Saved');
	await noSidewaysScroll(page);

	const size = async () => {
		const box = await saveToggle(page).boundingBox();
		return box && { width: box.width, height: box.height };
	};
	const before = await size();
	await saveToggle(page).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Remove from saved?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'false');
	expect(await size()).toEqual(before);
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText('Official');
	await expect(details(page).getByRole('button', { name: 'Share script' })).toBeEnabled();

	// Saved again from the same details.
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
	await backToList(page);
	await expect(details(page)).toBeVisible({ visible: test.info().project.name !== 'phone' });
});

/** A just-added script's dialog in the Library. */
const added = (page: Page, name: string) => page.getByRole('dialog', { name });

/** Save in the details: pressed when the script is saved. */
const saveToggle = (page: Page) => details(page).getByRole('button', { name: 'Save', exact: true });

/** Phones: the details cover the list until Back. */
async function backToList(page: Page) {
	const back = details(page).getByRole('button', { name: 'Back' });
	if (await back.isVisible()) await back.tap();
}

test('a pasted script with a typo is checked, then saved anyway', async ({ page }) => {
	await addScript(page);
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	await dialog.getByLabel('Script JSON').fill(JSON.stringify([...homebrew, 'fortune_teler']));
	await dialog.getByRole('button', { name: 'Confirm' }).tap();

	const check = page.getByRole('dialog', { name: 'Script check' });
	await expect(check).toContainText('Not loaded');
	await expect(check).toContainText('Did you mean Fortune Teller');
	await check.getByRole('button', { name: 'Confirm' }).tap();
	await expect(added(page, 'Storm Front')).toContainText('Trevor');
	await expect(added(page, 'Storm Front')).toContainText('Pasted');
});

test('hand-edited script JSON with comments and trailing commas is saved', async ({ page }) => {
	await addScript(page);
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	await dialog
		.getByLabel('Script JSON')
		.fill(
			'[\n  // made by hand\n  { "id": "_meta", "name": "Hand Made", },\n  "chef", "choirboy", "baron", "imp", /* more */\n]'
		);
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(added(page, 'Hand Made')).toContainText('Chef');
	await expect(added(page, 'Hand Made')).toContainText('Choirboy');
	await noSidewaysScroll(page);
});

test('script checks name setup changes and partners missing from the script', async ({ page }) => {
	const handMade = [{ id: '_meta', name: 'Hand Made' }, 'chef', 'choirboy', 'baron', 'imp'];
	await page.route('**/api/curated', (route) =>
		route.fulfill({
			json: {
				scripts: [{ section: 'recommended', link: scriptToolLink(handMade), json: handMade }]
			}
		})
	);
	await page.goto('/scripts');
	await chooseSource(page, 'Official custom scripts');
	await page.getByRole('button', { name: /^Hand Made/ }).tap();
	await expect(page.getByTestId('script-sheet')).toContainText('Chef');
	// The Baron changes setup; the Choirboy needs the King, who isn't here.
	await expect(page.getByTestId('script-checks')).toContainText('Baron');
	await expect(page.getByTestId('script-warnings')).toContainText('Choirboy');
	await expect(page.getByTestId('script-warnings')).toContainText('King');
	await expect(page.getByTestId('script-warnings')).toContainText('not on the script');
	await noSidewaysScroll(page);
});

test('a script file is saved straight away when nothing needs checking', async ({ page }) => {
	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	await expect(page.getByRole('dialog', { name: 'Script check' })).toHaveCount(0);
	await expect(added(page, 'Storm Front')).toContainText('storm-front.json');
	// A load that worked needs no message (Trevor).
	// (A toast; the details' own "Saved" heading over the name is not one.)
	await expect(page.getByRole('status').filter({ hasText: 'Saved Storm Front' })).toHaveCount(0);
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
	await page.goto('/scripts');
	await page.getByLabel('Search scripts').fill('42');
	// The number is fetched and listed as its own row; Save is in its details' header.
	await page.getByRole('button', { name: /^Storm Front/ }).tap();
	await expect(detailsName(page)).toHaveText('Storm Front');
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(details(page).getByRole('link', { name: 'BotC Scripts 1.2.0' })).toHaveAttribute(
		'href',
		'https://botcscripts.com/script/42/1.2.0'
	);
});

test('a pasted Bloodstar link, old address or new, is read through our Worker', async ({
	page
}) => {
	const asked: string[] = [];
	await page.route(/\/api\/bloodstar\/[^/]+\/[^/]+$/, (route) => {
		asked.push(new URL(route.request().url()).pathname);
		return route.fulfill({ json: homebrew });
	});
	await addScript(page);
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	await dialog
		.getByLabel('Link to the JSON')
		.fill('https://www.bloodstar.xyz/p/Trevor/Storm_Front/script.json?2715117b');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(detailsName(page)).toHaveText('Storm Front');
	expect(asked).toEqual(['/api/bloodstar/Trevor/Storm_Front']);
	// Saved with the site's new address, as the Library's script dialog shows.
	const saved = page.getByRole('dialog', { name: 'Storm Front' });
	await expect(saved.getByRole('link', { name: 'Bloodstar Clocktica' })).toHaveAttribute(
		'href',
		'https://bloodstar.clocktica.com/p/Trevor/Storm_Front/almanac.html'
	);
});

test('a link the browser may not read explains how to paste instead', async ({ page }) => {
	await page.route('https://scripts.example/blocked.json', (route) => route.abort('failed'));
	await addScript(page);
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	const load = dialog.getByRole('button', { name: 'Confirm' });
	await dialog.getByLabel('Link to the JSON').fill('https://scripts.example/blocked.json');
	await expect(dialog.getByRole('button', { name: 'Open link' })).toBeDisabled();
	const before = await load.boundingBox();
	await load.tap();
	await expect(dialog).toContainText('use Paste');
	await expect(dialog.getByRole('button', { name: 'Open link' })).toBeEnabled();
	// The error line is reserved, so the button does not move.
	expect(await load.boundingBox()).toEqual(before);
	// Open link sits inside the link's own field, just before its X (Trevor, 2026-10-18).
	const field = (await dialog.getByLabel('Link to the JSON').boundingBox())!;
	const open = (await dialog.getByRole('button', { name: 'Open link' }).boundingBox())!;
	const clear = (await dialog.getByRole('button', { name: 'Clear' }).boundingBox())!;
	for (const button of [open, clear]) {
		expect(button.y + button.height / 2).toBeCloseTo(field.y + field.height / 2, 0);
		expect(button.x + button.width).toBeLessThanOrEqual(field.x + field.width + 1);
		expect(button.width).toBeGreaterThanOrEqual(43.5);
	}
	expect(open.x + open.width).toBeLessThanOrEqual(clear.x + 1);
	// The text stops before both buttons.
	const padding = await dialog
		.getByLabel('Link to the JSON')
		.evaluate((input) => parseFloat(getComputedStyle(input).paddingInlineEnd));
	expect(field.x + field.width - padding).toBeLessThanOrEqual(open.x + 1);
	// It opens the site in a new tab (that site is unreachable here, so only the tab is seen).
	const popup = page.waitForEvent('popup');
	await dialog.getByRole('button', { name: 'Open link' }).tap();
	await popup;
});

test('a share link saves its script and clears the hash', async ({ page }) => {
	await page.goto(`/scripts#s=${await encodeSharedScript(homebrew)}`);
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(page).toHaveURL(/\/scripts$/);
});

test('a saved script is shared by QR code and link, with no code to type', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/library');
	// Codes are only for joining a game (Trevor, 2026-10-16).
	await page.getByRole('button', { name: 'Add script' }).tap();
	const add = page.getByRole('dialog', { name: 'Add script' });
	await expect(add.getByLabel('Link to the JSON')).toBeVisible();
	await expect(add.getByLabel('Script JSON')).toBeVisible();
	await expect(add.getByRole('button', { name: 'Upload File', exact: true })).toBeVisible();
	await expect(add.getByRole('button', { name: 'Code' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	const script = added(page, 'Storm Front');

	// One screen: QR code and link.
	await script.getByRole('button', { name: 'Share script' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Share Storm Front' });
	const qr = dialog.getByRole('img', { name: 'QR code for Storm Front' });
	await expect(qr).toBeVisible();
	// No logo: the script's name sits in the middle of the QR code (Trevor, 2026-10-19).
	await expect(qr.getByTestId('qr-name')).toHaveText('Storm Front');
	await expect(qr.getByTestId('script-logo')).toHaveCount(0);
	await expect(dialog.getByTestId('share-url')).toHaveValue(/\/play#c=\d{6}$/);
	await expect(dialog.getByTestId('share-digits')).toHaveCount(0);
	// One icon beside the link copies it; no success popup.
	await dialog.getByRole('button', { name: 'Copy link' }).tap();
	await expect(page.getByText('Link copied')).toHaveCount(0);
	// The link opens the player view, with the script in the hash (never the query string).
	const link = await page.evaluate(() => navigator.clipboard.readText());
	expect(link).toMatch(/^http:\/\/localhost:\d+\/play#c=\d{6}$/);
	await noSidewaysScroll(page);

	// The link is kept while the script is unchanged: opening Share again asks nothing new.
	const asked: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('/api/share')) asked.push(r.url());
	});
	await page.keyboard.press('Escape');
	await script.getByRole('button', { name: 'Share script' }).tap();
	await expect(dialog.getByTestId('share-url')).toHaveValue(link);
	expect(asked).toEqual([]);

	// Another phone opens the link, as from the QR code.
	const other = await context.newPage();
	await other.goto(new URL(link).pathname + new URL(link).hash);
	await expect(other.getByRole('heading', { name: 'Storm Front', level: 1 })).toBeVisible();
});

test("a script's logo sits in the middle of its QR code, and its name if the logo fails", async ({
	page
}, testInfo) => {
	const logo = 'https://logos.example/storm-front.svg';
	const missing = 'https://logos.example/missing.svg';
	await page.route(logo, (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>'
		})
	);
	await page.route(missing, (route) => route.abort());
	const share = async (name: string, logoLink: string) => {
		await page.goto('/library');
		await page.getByLabel('Script file').setInputFiles({
			name: 'script.json',
			mimeType: 'application/json',
			buffer: Buffer.from(
				JSON.stringify([
					{ id: '_meta', name, author: 'Trevor', logo: logoLink },
					...homebrew.slice(1)
				])
			)
		});
		await added(page, name).getByRole('button', { name: 'Share script' }).tap();
		return page
			.getByRole('dialog', { name: `Share ${name}` })
			.getByRole('img', { name: `QR code for ${name}` });
	};

	const qr = await share('Storm Front', logo);
	const center = qr.getByTestId('qr-center');
	await expect(center.getByTestId('script-logo')).toHaveAttribute('data-logo', logo);
	await expect(center.getByTestId('qr-name')).toHaveCount(0);
	// The logo covers under 10% of the code, so it still scans at the highest correction.
	const [code, middle] = await Promise.all([qr.boundingBox(), center.boundingBox()]);
	expect((middle!.width * middle!.height) / (code!.width * code!.height)).toBeLessThan(0.1);
	// The backing covers whole squares of the code (Trevor, 2026-10-23: no slivers round it),
	// and the logo sits over exactly those squares.
	const backing = qr.getByTestId('qr-backing');
	for (const edge of ['x', 'y', 'width', 'height']) {
		expect(Number.isInteger(Number(await backing.getAttribute(edge)))).toBe(true);
	}
	const drawn = (await backing.boundingBox())!;
	expect(Math.abs(drawn.x - middle!.x)).toBeLessThan(1);
	expect(Math.abs(drawn.width - middle!.width)).toBeLessThan(1);
	await qr.screenshot({ path: testInfo.outputPath('qr.png') });

	// A logo that fails to load leaves the name instead, never an empty square.
	const broken = await share('Calm Front', missing);
	await expect(broken.getByTestId('qr-name')).toHaveText('Calm Front');
});

test('dropping a script file anywhere on the Library saves it; Search takes no drops', async ({
	page
}) => {
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
		await expect(page.getByTestId('drop-overlay')).toHaveClass(/active/, { timeout: 2000 });
		await page.dispatchEvent('main', 'drop', { dataTransfer: data });
	};

	// Search finds scripts, it doesn't add them (Trevor, 2026-10-17).
	await page.goto('/scripts');
	await expect(
		drop('storm-front.json', 'application/json', JSON.stringify(homebrew))
	).rejects.toThrow();
	await expect(detailsName(page)).toHaveText('None');

	await page.goto('/library');
	await drop('photo.png', 'image/png', 'not a script');
	// Said in a toast, so nothing on the page moves.
	await expect(
		page
			.getByRole('status')
			.filter({ hasText: 'photo.png is not a script. Scripts are .json files.' })
	).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Storm Front' })).toHaveCount(0);

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

	await page.goto('/scripts');
	// One source at a time, BotC Scripts first (Trevor, 2026-10-17).
	await expect(sourcePicker(page)).toContainText('BotC Scripts');
	const status = page.getByTestId('picker-status');
	await expect(status).toHaveText('2 on BotC Scripts · most votes');
	const table = page.getByRole('table', { name: 'Scripts' });
	// The site's columns, with the characters counted from the script.
	const first = table.locator('tbody tr').first();
	await expect(first).toContainText('Most Voted One');
	await expect(first.locator('[data-col="characters"]')).toHaveText('7');
	// Phones keep Name, Author and Type; Chars and Likes give way (Chars' filter moves to Name).
	const phone = test.info().project.name === 'phone';
	if (!phone) await expect(first.locator('[data-col="likes"]')).toHaveText('5');

	await page.getByLabel('Search scripts').fill('storm');
	await expect(status).toHaveText('1 on BotC Scripts · most votes');

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
	// One request on opening, one after typing paused, one per filter.
	expect(searches).toEqual([
		'?page=1',
		'?page=1&q=storm',
		'?page=1&q=storm&type=Teensyville',
		'?page=1&q=storm&type=Teensyville&include=imp',
		'?page=1&q=storm&type=Teensyville&include=imp&editions=base,carousel'
	]);

	// Chars sorts what is loaded, without asking the site again. (Likes and No. give way on
	// phones and tablets.)
	if (!phone) {
		const chars = table.getByRole('columnheader', { name: 'Chars' });
		await chars.getByRole('button', { name: 'Chars', exact: true }).tap();
		await expect(chars).toHaveAttribute('aria-sort', 'ascending');
		expect(searches).toHaveLength(5);
	}

	// Tapping a result shows its characters beside the list, no modal; nothing saves until Save.
	await expect(detailsName(page)).toHaveText('None');
	await table.getByRole('button', { name: /^Storm Front/ }).tap();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(detailsName(page)).toHaveText('Storm Front');
	await expect(details(page)).toContainText('Storm Warden');
	await expect(details(page)).toContainText('Imp');
	await expect(details(page).getByRole('link', { name: 'BotC Scripts 1.0.0' })).toHaveAttribute(
		'href',
		'https://botcscripts.com/script/1900/1.0.0'
	);
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
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

// Teensyville, so the Type filter set earlier in the test still lists them.
const monthly = (name: string) => [
	{ id: '_meta', name, author: 'Someone Monthly' },
	...teensy.slice(1)
];

test("the official site's custom scripts are a source of their own, and saved", async ({
	page
}) => {
	let asked = 0;
	await page.route('**/api/curated', (route) => {
		asked++;
		return route.fulfill({
			json: {
				scripts: [
					{ section: 'teensyville', link: scriptToolLink(teensy), json: teensy },
					{ section: 'recommended', link: scriptToolLink(bigTown), json: bigTown },
					{
						section: 'month',
						link: scriptToolLink(monthly('Autumn Fair')),
						json: monthly('Autumn Fair'),
						seen: '2026-10'
					},
					{
						section: 'month',
						link: scriptToolLink(monthly('Summer Fete')),
						json: monthly('Summer Fete'),
						seen: '2026-09',
						past: true
					}
				]
			}
		});
	});
	await page.goto('/scripts');
	// Only fetched once chosen; then the choice is remembered on the device.
	await expect(page.getByTestId('picker-status')).toHaveText('None');
	expect(asked).toBe(0);
	await chooseSource(page, 'Official custom scripts');
	await expect(page.getByTestId('picker-status')).toHaveText('2 scripts');
	expect(asked).toBe(1);
	await page.reload();
	await expect(sourcePicker(page)).toContainText('Official custom scripts');
	await expect(page.getByTestId('picker-status')).toHaveText('2 scripts');
	const table = page.getByRole('table', { name: 'Scripts' });
	// No Likes or No. columns: only BotC Scripts has them.
	await expect(table.getByRole('columnheader', { name: /^Likes/ })).toHaveCount(0);
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

	// Anywhere in a row selects its script, not just the name (Trevor).
	await table.getByRole('cell', { name: 'Someone Big' }).tap();
	await expect(detailsName(page)).toHaveText('Big Town');
	await backToList(page);
	await table
		.locator('tbody tr')
		.filter({ hasText: 'Little Hamlet' })
		.locator('[data-col="kind"]')
		.tap();
	await expect(detailsName(page)).toHaveText('Little Hamlet');
	await backToList(page);

	// Teensyville only, from the funnel in the Type column's header (its own column on phones too).
	const typeFilter = table.getByRole('button', { name: 'Filter Type', exact: true });
	await typeFilter.tap();
	await page.getByRole('dialog', { name: 'Filter Type' }).getByLabel('Teensyville').tap();
	await expect(page.getByTestId('picker-status')).toHaveText('1 script');

	await pick(page, 'Little Hamlet');
	await expect(detailsName(page)).toHaveText('Little Hamlet');
	// Its Source, the section it is listed in, opens the official page that lists it.
	await expect(details(page).getByRole('link', { name: 'Teensyville' })).toHaveAttribute(
		'href',
		'https://bloodontheclocktower.com/pages/custom-scripts'
	);
	// Not saved, yet shown as the players' script, abilities and all.
	await expect(page.getByTestId('script-sheet')).toContainText('pairs of evil players');
	// Script checks: characters per type, no setup changes, nothing missing.
	const checks = page.getByTestId('script-checks');
	await expect(checks.locator('[data-type="townsfolk"]')).toHaveText('5');
	await expect(checks.locator('[data-type="outsider"]')).toHaveText('2');
	await expect(page.getByTestId('script-warnings')).toHaveCount(0);
	await noSidewaysScroll(page);

	// Scripts of the Month are a source of their own, past months kept, newest first.
	await backToList(page);
	await chooseSource(page, 'Scripts of the Month');
	await expect(page.getByTestId('picker-status')).toHaveText('2 scripts');
	await expect(table.locator('tbody tr').first()).toContainText('Autumn Fair');
	await expect(table.locator('tbody tr').nth(1)).toContainText('Summer Fete');
	// Each named by the month our copy first saw it.
	await expect(table.getByRole('button', { name: 'Summer Fete September 2026' })).toBeVisible();
});

test('Play starts a new game with a found script, without saving it', async ({ page }) => {
	await page.route('**/api/curated', (route) =>
		route.fulfill({
			json: { scripts: [{ section: 'recommended', link: scriptToolLink(bigTown), json: bigTown }] }
		})
	);
	await page.goto('/scripts');
	await chooseSource(page, 'Official custom scripts');
	await page.getByRole('button', { name: /^Big Town/ }).tap();
	await expect(detailsName(page)).toHaveText('Big Town');
	await details(page).getByRole('button', { name: 'Play', exact: true }).tap();

	// New game opens with it chosen (Trevor, 2026-10-17: the Library stays what was saved).
	await expect(page).toHaveURL(/\/new$/);
	// Found in the script search, beside the base three (Trevor, 2026-10-19).
	const script = page.getByRole('radiogroup', { name: 'Script' });
	const search = page.getByRole('combobox', { name: 'Find a script' });
	await expect(search).toHaveValue('Big Town');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);

	// Still offered after a reload, and never saved.
	await page.goto('/new');
	await expect(script.getByRole('radio', { name: 'Trouble Brewing' })).toBeChecked();
	await expect(search).toHaveValue('');
	await expect(script.getByRole('radio', { name: 'Custom' })).not.toBeChecked();
	await script.getByText('Custom', { exact: true }).tap();
	await search.tap();
	await expect(page.getByRole('option').filter({ hasText: 'Big Town' })).toHaveCount(1);
	await page.keyboard.press('Escape');
	await page.goto('/scripts');
	await page.getByRole('button', { name: /^Big Town/ }).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('a Script Tool link is read from the link itself, with no request', async ({ page }) => {
	const requests: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('bloodontheclocktower.com')) requests.push(r.url());
	});
	await addScript(page);
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	await dialog.getByLabel('Link to the JSON').fill(scriptToolLink(teensy));
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(detailsName(page)).toHaveText('Little Hamlet');
	expect(requests).toEqual([]);
});

test('a Script Tool share link, encoded twice as the official site writes them, adds its homebrew too', async ({
	page
}) => {
	const requests: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('bloodontheclocktower.com')) requests.push(r.url());
	});
	// The official Scripts page links like this: the gzipped, base64 JSON URL-encoded twice.
	const payload = gzipSync(Buffer.from(JSON.stringify(homebrew))).toString('base64');
	const link = `https://script.bloodontheclocktower.com/?script=${encodeURIComponent(encodeURIComponent(payload))}`;
	await addScript(page);
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	await dialog.getByLabel('Link to the JSON').fill(link);
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(detailsName(page)).toHaveText('Storm Front');
	// The homebrew character comes through as in pasted JSON.
	await expect(added(page, 'Storm Front')).toContainText('Storm Warden');
	expect(requests).toEqual([]);
});

test('more BotC Scripts results load by themselves when the list end comes near', async ({
	page
}) => {
	const pages: number[] = [];
	await page.route(/\/api\/botcscripts\/search\?/, (route) => {
		const n = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
		pages.push(n);
		const results = Array.from({ length: 30 }, (_, i) => ({
			scriptId: n * 100 + i,
			versionId: n * 100 + i,
			name: `Page ${n} Script ${i + 1}`,
			version: '1.0.0',
			author: 'Someone',
			type: 'Full',
			score: 60 - i,
			characters: [{ id: 'chef' }, { id: 'imp' }]
		}));
		return route.fulfill({ json: { page: n, count: 60, hasMore: n < 2, results } });
	});
	await page.goto('/scripts');
	const table = page.getByRole('table', { name: 'Scripts' });
	await expect(table).toContainText('Page 1 Script 30');
	// No More button (Trevor, 2026-10-17): scrolling to the end loads the next page.
	await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
	await table.locator('tbody tr').last().scrollIntoViewIfNeeded();
	await expect(table).toContainText('Page 2 Script 30');
	await table.locator('tbody tr').last().scrollIntoViewIfNeeded();
	// The site has no more, so nothing else is asked for.
	await expect.poll(() => pages).toEqual([1, 2]);
	await noSidewaysScroll(page);
});

test('a World Cup is a source: its finalists load from BotC Scripts and link there', async ({
	page
}) => {
	// Served from our own copy, in one answer (Trevor, 2026-10-17: self-hosted).
	const asked: string[] = [];
	await page.route('**/api/world-cups/*', (route) => {
		asked.push(route.request().url().split('/').at(-1)!);
		return route.fulfill({
			json: {
				scripts: WORLD_CUPS['2025'].entries.map(({ scriptId }) => ({
					scriptId,
					version: '1.0.0',
					json: [
						{
							id: '_meta',
							name: scriptId === 6687 ? 'The Ballad of Seat 7' : `Script ${scriptId}`
						},
						...teensy.slice(1)
					]
				})),
				fetchedAt: '2026-10-17T04:17:00.000Z'
			}
		});
	});
	await page.goto('/scripts');
	expect(asked).toEqual([]);
	await chooseSource(page, 'World Cup 2025');
	await expect(page.getByTestId('picker-status')).toHaveText('16 scripts');
	expect(asked).toEqual(['2025']);
	const table = page.getByRole('table', { name: 'Scripts' });
	// In the World Cup's order, winner first.
	await expect(table.locator('tbody tr').first()).toContainText('The Ballad of Seat 7');
	await table.getByRole('button', { name: /^The Ballad of Seat 7/ }).tap();
	await expect(detailsName(page)).toHaveText('The Ballad of Seat 7');
	await expect(
		details(page).getByRole('link', { name: 'World Cup 2025 · Winner' })
	).toHaveAttribute('href', 'https://botcscripts.com/script/6687/1.0.0');
	await expect(page.getByTestId('script-sheet')).toContainText('Chef');
	await noSidewaysScroll(page);
});

test('a BotC Scripts result offers its other versions, and says when a newer one is out', async ({
	page
}) => {
	const content = (version: string) => [
		{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
		...homebrew.slice(1),
		...(version === '1.1.0' ? ['mayor'] : [])
	];
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 1900,
						versionId: 900,
						name: 'Storm Front',
						version: '1.0.0',
						author: 'Trevor',
						type: 'Full',
						score: 5,
						characters: [{ id: 'chef' }, { id: 'imp' }]
					}
				]
			}
		})
	);
	await page.route('**/api/botcscripts/versions/1900', (route) =>
		route.fulfill({ json: { scriptId: 1900, latest: '1.1.0', versions: ['1.1.0', '1.0.0'] } })
	);
	let release: () => void = () => {};
	const held = new Promise<void>((done) => (release = done));
	await page.route(
		/\/api\/botcscripts\/(version\/900|script\/1900\/1\.[01]\.0)$/,
		async (route) => {
			const version = route.request().url().endsWith('1.1.0') ? '1.1.0' : '1.0.0';
			await held;
			return route.fulfill({
				json: {
					scriptId: 1900,
					versionId: version === '1.1.0' ? 901 : 900,
					name: 'Storm Front',
					version,
					author: 'Trevor',
					content: content(version)
				}
			});
		}
	);

	await page.goto('/scripts');
	await page
		.getByRole('table', { name: 'Scripts' })
		.getByRole('button', { name: /^Storm Front/ })
		.tap();
	await expect(detailsName(page)).toHaveText('Storm Front');
	// While the script loads, its characters are not first shown in a line, and the space is
	// never blank: it says the script is loading (Trevor, 2026-10-17).
	await expect(page.getByTestId('script-loading')).toBeVisible();
	await expect(page.getByTestId('script-characters')).toHaveCount(0);
	await expect(page.getByTestId('script-sheet')).not.toContainText('Washerwoman');
	release();
	await expect(page.getByTestId('script-sheet')).toContainText('Washerwoman');
	await expect(page.getByTestId('script-loading')).toHaveCount(0);
	// Scrolling the details keeps Back (phones) and the script's name pinned at the top.
	const top = details(page).getByTestId('script-details-top');
	const pinnedAt = (await top.boundingBox())!.y;
	await page.locator('.pane-scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight));
	await expect.poll(async () => (await top.boundingBox())!.y).toBeLessThanOrEqual(pinnedAt);
	await expect(detailsName(page)).toBeInViewport();
	const paneTop = (await details(page).boundingBox())!.y;
	expect((await top.boundingBox())!.y).toBeGreaterThanOrEqual(paneTop - 1);
	await page.locator('.pane-scroll').evaluate((el) => el.scrollTo(0, 0));
	// Checks are rows of the main info, the counts on one line.
	await expect(details(page).getByTestId('script-checks')).toContainText('Townsfolk');
	await expect(page.getByRole('button', { name: 'Script checks' })).toHaveCount(0);
	// Where the details cover the list (phones), the table's sticky header never shows on top.
	await expect
		.poll(() =>
			page.evaluate(() => {
				const head = document.querySelector('[data-testid="picker-table"] thead');
				const pane = document.querySelector('aside.pane');
				if (!head || !pane) return 'missing';
				const h = head.getBoundingClientRect();
				const p = pane.getBoundingClientRect();
				const [x, y] = [h.left + h.width / 2, h.top + h.height / 2];
				// Beside the list (wide screens), or still sliding in over it (phones).
				if (p.left > h.left + 1) return p.left >= h.right ? 'not covered' : 'sliding';
				if (y < p.top || y > p.bottom) return 'not covered';
				// The covered list is inert, which hides it from hit tests: lift that to look.
				const list = head.closest<HTMLElement>('[inert]');
				if (list) list.inert = false;
				const top = document.elementFromPoint(x, y);
				if (list) list.inert = true;
				return pane.contains(top) ? 'not covered' : 'header on top';
			})
		)
		.toBe('not covered');
	// The site has 1.1.0: the details say so, in space kept for it.
	const newer = details(page).getByTestId('newer-version').getByRole('button');
	await expect(newer).toHaveText('Newer: 1.1.0');
	// "Newer" sits under the version picker, which keeps a readable width (Trevor, 2026-10-17).
	const picker = details(page).getByRole('combobox', { name: 'Version' });
	const [pickBox, newerBox] = [await picker.boundingBox(), await newer.boundingBox()];
	expect(pickBox && newerBox && newerBox.y >= pickBox.y + pickBox.height - 1).toBe(true);
	expect(pickBox && pickBox.width >= newerBox!.width).toBe(true);
	await expect(page.getByTestId('script-sheet')).not.toContainText('Mayor');
	await newer.tap();
	await expect(details(page).getByRole('combobox', { name: 'Version' })).toContainText('1.1.0');
	await expect(details(page).getByRole('link', { name: 'BotC Scripts 1.1.0' })).toHaveAttribute(
		'href',
		'https://botcscripts.com/script/1900/1.1.0'
	);
	await expect(page.getByTestId('script-sheet')).toContainText('Mayor');
	await expect(newer).toBeHidden();

	// Previous versions are listed too, and can be viewed again.
	await details(page).getByRole('combobox', { name: 'Version' }).tap();
	await page.getByRole('option', { name: '1.0.0', exact: true }).tap();
	await expect(page.getByTestId('script-sheet')).not.toContainText('Mayor');
	// Print, beside Share, prints the version shown.
	await page.evaluate(() => {
		window.print = () => {
			const sheet = document.querySelector('[data-testid="print-sheet"]');
			(window as unknown as { printed: string }).printed = sheet?.textContent ?? '';
		};
	});
	await details(page).getByRole('button', { name: 'Print script' }).tap();
	await page
		.getByRole('dialog', { name: 'Print script' })
		.getByRole('button', { name: 'Print our sheet' })
		.tap();
	await page
		.getByRole('dialog', { name: 'Print our sheet' })
		.getByRole('button', { name: 'Print', exact: true })
		.tap();
	// Printing first waits up to five seconds for the sheet and its icons, so poll longer than that.
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { printed?: string }).printed), {
			timeout: 15_000
		})
		.toContain('Storm Warden');
	const printed = await page.evaluate(() => (window as unknown as { printed: string }).printed);
	expect(printed).toContain('1.0.0');
	expect(printed).not.toContain('Mayor');
	// Saving keeps the version shown.
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(details(page).getByRole('link', { name: 'BotC Scripts 1.0.0' })).toBeVisible();
	await noSidewaysScroll(page);
});

test('Bloodstar Clocktica is a source: found by folder names, each script loads when opened', async ({
	page
}) => {
	const asked: string[] = [];
	await page.route('**/api/bloodstar', (route) =>
		route.fulfill({
			json: {
				scripts: [
					{ user: 'Someone', edition: 'Stone_and_Salt' },
					{ user: 'Another', edition: 'Lanterns' }
				]
			}
		})
	);
	await page.route(/\/api\/bloodstar\/[^/]+\/[^/]+$/, (route) => {
		asked.push(new URL(route.request().url()).pathname);
		return route.fulfill({
			json: [
				{ id: '_meta', name: 'Stone and Salt', author: 'Some One' },
				{
					id: 'quarrywarden',
					name: 'Quarry Warden',
					team: 'townsfolk',
					ability: 'You start knowing how many steps from the Demon to its nearest Minion.'
				},
				'chef',
				'imp'
			]
		});
	});
	await page.goto('/scripts');
	await chooseSource(page, 'Bloodstar Clocktica');
	await expect(page.getByTestId('picker-status')).toHaveText('2 scripts');
	await page.getByLabel('Search scripts').fill('salt');
	await expect(page.getByTestId('picker-status')).toHaveText('1 script');
	expect(asked).toEqual([]);
	await page
		.getByRole('table', { name: 'Scripts' })
		.getByRole('button', { name: /^Stone and Salt/ })
		.tap();
	await expect(page.getByTestId('script-sheet')).toContainText('nearest Minion');
	await expect(detailsName(page)).toHaveText('Stone and Salt');
	expect(asked).toEqual(['/api/bloodstar/Someone/Stone_and_Salt']);
	await expect(details(page).getByRole('link', { name: 'Bloodstar' })).toHaveAttribute(
		'href',
		'https://bloodstar.clocktica.com/p/Someone/Stone_and_Salt/almanac.html'
	);
	await noSidewaysScroll(page);
});

test('a long list is drawn a page at a time as it scrolls', async ({ page }) => {
	const scripts = Array.from({ length: 250 }, (_, i) => ({
		user: 'someone',
		edition: `Script_${i}`
	}));
	await page.route('**/api/bloodstar', (route) => route.fulfill({ json: { scripts } }));
	await page.goto('/scripts');
	await chooseSource(page, 'Bloodstar Clocktica');
	// The count is the whole list; only the first page of rows is built.
	await expect(page.getByTestId('picker-status')).toHaveText('250 scripts');
	const rows = page
		.getByRole('table', { name: 'Scripts' })
		.locator('tbody tr:not(.more-rows, .empty)');
	await expect(rows).toHaveCount(100);
	// The rows not drawn yet keep their space, so a scroll never stops at a page's end
	// (Trevor, 2026-10-18: it only went on once he let go).
	const scroller = page.locator('.data-table .scroll');
	const full = await scroller.evaluate((box) => box.scrollHeight);
	await rows.last().scrollIntoViewIfNeeded();
	await expect(rows).toHaveCount(200);
	expect(Math.abs((await scroller.evaluate((box) => box.scrollHeight)) - full)).toBeLessThan(
		full * 0.05
	);
	expect(full).toBeGreaterThan((await rows.first().boundingBox())!.height * 200);
	await rows.last().scrollIntoViewIfNeeded();
	await expect(rows).toHaveCount(250);
	// A new search starts again at one page.
	await page.getByLabel('Search scripts').fill('1');
	await expect(page.getByTestId('picker-status')).toHaveText('133 scripts');
	await expect(rows).toHaveCount(100);
});

test('the BOTC HomeBrew Wiki is a source: each script loads when opened and links to its page', async ({
	page
}) => {
	const asked: string[] = [];
	await page.route('**/api/homebrew-scripts', (route) =>
		route.fulfill({
			json: {
				scripts: [
					{
						slug: 'stone-and-salt',
						name: 'Stone and Salt',
						author: 'Someone',
						characters: [
							{ id: 'quarry-warden', name: 'Quarry Warden', team: 'townsfolk' },
							{ id: 'chef' },
							{ id: 'imp' }
						]
					}
				]
			}
		})
	);
	let release = () => {};
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/api/homebrew-scripts/*', async (route) => {
		asked.push(route.request().url().split('/').at(-1)!);
		await held;
		return route.fulfill({
			json: [
				{ id: '_meta', name: 'Stone and Salt', author: 'Someone' },
				{
					id: 'quarry-warden',
					name: 'Quarry Warden',
					team: 'townsfolk',
					ability: 'You start knowing how many steps from the Demon to its nearest Minion.'
				},
				'chef',
				'imp'
			]
		});
	});
	await page.goto('/scripts');
	await chooseSource(page, 'BOTC HomeBrew Wiki');
	await expect(page.getByTestId('picker-status')).toHaveText('1 script');
	expect(asked).toEqual([]);
	await page
		.getByRole('table', { name: 'Scripts' })
		.getByRole('button', { name: /^Stone and Salt/ })
		.tap();
	await expect(detailsName(page)).toHaveText('Stone and Salt');
	await expect(details(page).getByRole('link', { name: 'HomeBrew Wiki' })).toHaveAttribute(
		'href',
		'https://botchomebrew.wiki/s/stone-and-salt'
	);
	// Never blank while it loads; then its own characters' abilities.
	await expect(page.getByTestId('script-loading')).toBeVisible();
	release();
	await expect(page.getByTestId('script-sheet')).toContainText('Quarry Warden');
	await expect(page.getByTestId('script-sheet')).toContainText('nearest Minion');
	expect(asked).toEqual(['stone-and-salt']);
	// Saved, its Source is unchanged and still links to its page; nothing is fetched again.
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(
		details(page).getByRole('link', { name: 'HomeBrew Wiki', exact: true })
	).toHaveAttribute('href', 'https://botchomebrew.wiki/s/stone-and-salt');
	expect(asked).toEqual(['stone-and-salt']);
	await noSidewaysScroll(page);
});

test('the results table headers never overlap, even on a phone', async ({ page }) => {
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 1900,
						versionId: 900,
						name: 'Storm Front',
						version: '1.0.0',
						author: 'Trevor',
						type: 'Full',
						score: 5,
						characters: [{ id: 'chef' }, { id: 'imp' }]
					}
				]
			}
		})
	);
	await page.goto('/scripts');
	await expect(page.getByRole('button', { name: /^Storm Front/ })).toBeVisible();
	// Every sort and filter button in the header row: inside its own column, clear of the rest.
	const problems = await page.locator('thead').evaluate((head) => {
		const boxes = [...head.querySelectorAll('button')]
			.map((button) => ({
				name: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
				box: button.getBoundingClientRect(),
				cell: button.closest('th')!.getBoundingClientRect()
			}))
			.filter(({ box }) => box.width > 0);
		const found: string[] = [];
		const slack = 0.5;
		for (const button of head.querySelectorAll('button')) {
			// A squeezed button spills its label and arrows under its neighbour.
			if (button.scrollWidth > button.clientWidth + 1) {
				found.push(
					`${button.getAttribute('aria-label') ?? button.textContent?.trim()} spills over`
				);
			}
		}
		for (const { name, box, cell } of boxes) {
			if (box.left < cell.left - slack || box.right > cell.right + slack) {
				found.push(`${name} leaves its column`);
			}
		}
		boxes.forEach((a, i) =>
			boxes.slice(i + 1).forEach((b) => {
				const apart =
					a.box.right <= b.box.left + slack ||
					b.box.right <= a.box.left + slack ||
					a.box.bottom <= b.box.top + slack ||
					b.box.bottom <= a.box.top + slack;
				if (!apart) found.push(`${a.name} overlaps ${b.name}`);
			})
		);
		return found;
	});
	expect(problems).toEqual([]);
	await noSidewaysScroll(page);
});

test('Add script is one dialog: the link and the JSON take turns, and the layout never moves', async ({
	page
}) => {
	await addScript(page);
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	const link = dialog.getByLabel('Link to the JSON');
	const json = dialog.getByLabel('Script JSON');
	const confirm = dialog.getByRole('button', { name: 'Confirm' });
	await expect(confirm).toBeDisabled();
	const before = await confirm.boundingBox();
	// Filling one disables the other, so it is always clear which one Confirm adds.
	await link.fill('https://scripts.example/a.json');
	await expect(json).toBeDisabled();
	await expect(confirm).toBeEnabled();
	await link.fill('');
	await json.fill(JSON.stringify(homebrew));
	await expect(link).toBeDisabled();
	expect(await confirm.boundingBox()).toEqual(before);
	await confirm.tap();
	await expect(dialog).toBeHidden();
	await expect(detailsName(page)).toHaveText('Storm Front');
	await noSidewaysScroll(page);
});

test('Upload File in the Add script dialog adds the chosen file straight away', async ({
	page
}) => {
	await addScript(page);
	const dialog = page.getByRole('dialog', { name: 'Add script' });
	const chooser = page.waitForEvent('filechooser');
	await dialog.getByRole('button', { name: 'Upload File', exact: true }).tap();
	await (
		await chooser
	).setFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	await expect(dialog).toBeHidden();
	await expect(detailsName(page)).toHaveText('Storm Front');
});

test('a Search script shares before it is saved, and Save changes nothing but itself', async ({
	page
}) => {
	const content = [{ id: '_meta', name: 'Storm Front', author: 'Trevor' }, ...homebrew.slice(1)];
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 1900,
						versionId: 900,
						name: 'Storm Front',
						version: '1.0.0',
						author: 'Trevor',
						type: 'Full',
						score: 5,
						characters: [{ id: 'chef' }, { id: 'imp' }]
					}
				]
			}
		})
	);
	await page.route('**/api/botcscripts/versions/1900', (route) =>
		route.fulfill({ json: { scriptId: 1900, latest: '1.0.0', versions: ['1.0.0'] } })
	);
	await page.route(/\/api\/botcscripts\/(version\/900|script\/1900\/1\.0\.0)$/, (route) =>
		route.fulfill({
			json: {
				scriptId: 1900,
				versionId: 900,
				name: 'Storm Front',
				version: '1.0.0',
				author: 'Trevor',
				content
			}
		})
	);
	await page.goto('/scripts');
	await page.getByRole('button', { name: /^Storm Front/ }).tap();
	const top = details(page).getByTestId('script-details-top');
	await expect(top.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
	// Share is for any shown script, saved or not (Trevor, 2026-10-19).
	await expect(top.getByRole('button', { name: 'Share script' })).toBeEnabled();
	// Saving left Play, Print and Share flashing off and on (Trevor, 2026-10-19).
	await top.evaluate((el) => {
		const seen: string[] = [];
		(window as unknown as { seen: string[] }).seen = seen;
		new MutationObserver((records) => {
			for (const r of records) {
				const target = r.target as Element;
				const name = target.getAttribute?.('aria-label') ?? target.nodeName;
				if (r.type === 'attributes') seen.push(`${name} ${r.attributeName}`);
				else if (r.addedNodes.length || r.removedNodes.length) seen.push(`${name} children`);
			}
		}).observe(el, {
			attributes: true,
			attributeFilter: ['disabled', 'aria-disabled', 'data-disabled'],
			childList: true,
			subtree: true
		});
	});
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
	await page.waitForTimeout(300);
	expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual([]);
	await top.getByRole('button', { name: 'Share script' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Share Storm Front' }).getByTestId('share-url')
	).toHaveValue(/#/);
});

test('Save in a Search script header puts the script in the Library', async ({ page }) => {
	const content = [{ id: '_meta', name: 'Storm Front', author: 'Trevor' }, ...homebrew.slice(1)];
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 1900,
						versionId: 900,
						name: 'Storm Front',
						version: '1.0.0',
						author: 'Trevor',
						type: 'Full',
						score: 5,
						characters: [{ id: 'chef' }, { id: 'imp' }]
					}
				]
			}
		})
	);
	await page.route('**/api/botcscripts/versions/1900', (route) =>
		route.fulfill({ json: { scriptId: 1900, latest: '1.0.0', versions: ['1.0.0'] } })
	);
	await page.route(/\/api\/botcscripts\/(version\/900|script\/1900\/1\.0\.0)$/, (route) =>
		route.fulfill({
			json: {
				scriptId: 1900,
				versionId: 900,
				name: 'Storm Front',
				version: '1.0.0',
				author: 'Trevor',
				content
			}
		})
	);
	await page.goto('/scripts');
	await page.getByRole('button', { name: /^Storm Front/ }).tap();
	// The controls are in the pinned header with the name (Trevor, 2026-10-18), not under the list.
	const top = details(page).getByTestId('script-details-top');
	for (const name of ['Play', 'Save']) {
		await expect(top.getByRole('button', { name, exact: true })).toBeVisible();
	}
	await expect(page.getByTestId('picker-more').getByRole('button')).toHaveCount(0);
	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
	await page.goto('/library');
	await expect(page.getByRole('button', { name: /Storm Front/ }).first()).toBeVisible();
});

test('a narrow table keeps its header to the labels, with the dropped filters on one row', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'phone', 'only phones drop columns');
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 1900,
						versionId: 900,
						name: 'Storm Front',
						version: '1.0.0',
						author: 'Trevor',
						type: 'Full',
						score: 5,
						characters: [{ id: 'chef' }]
					}
				]
			}
		})
	);
	await page.goto('/scripts');
	const table = page.getByRole('table', { name: 'Scripts' });
	await expect(table.getByRole('button', { name: /^Storm Front/ })).toBeVisible();
	// Trevor, 2026-10-18: Name, Chars, Likes, No. and Columns stacked on five lines.
	const name = table.locator('thead th[data-col="name"]');
	const author = table.locator('thead th[data-col="author"]');
	expect((await name.boundingBox())!.height).toBeLessThanOrEqual(
		(await author.boundingBox())!.height + 1
	);
	const moved = table.locator('thead th.moved').getByRole('button');
	await expect(moved.and(page.getByRole('button', { name: 'Filter Likes' }))).toBeVisible();
	await expect(moved.and(page.getByRole('button', { name: 'Filter No.' }))).toBeVisible();
	const tops = await moved.evaluateAll((buttons) =>
		buttons
			.filter((b) => b.getClientRects().length)
			.map((b) => Math.round(b.getBoundingClientRect().top))
	);
	expect(new Set(tops).size).toBe(1);
});

test('on a phone each Search row is two lines: the whole name, then Author and Type', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'phone', 'only phones split rows');
	const name = 'The Storm Front Over Ravenswood';
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 1900,
						versionId: 900,
						name,
						version: '1.0.0',
						author: 'Andrew Nathenson',
						type: 'Teensyville',
						score: 5,
						characters: [{ id: 'chef' }]
					}
				]
			}
		})
	);
	await page.goto('/scripts');
	const table = page.getByRole('table', { name: 'Scripts' });
	const row = table.locator('tbody tr').filter({ hasText: name });
	await expect(row).toBeVisible();
	// Trevor, 2026-10-19: names were cut to three letters ("One ...") beside Author and Type.
	const title = row.locator('.title');
	expect(await title.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
	const [nameCell, author, type] = await Promise.all(
		['name', 'author', 'kind'].map((col) => row.locator(`[data-col="${col}"]`).boundingBox())
	);
	expect(author!.y).toBeGreaterThanOrEqual(nameCell!.y + nameCell!.height - 1);
	expect(Math.round(type!.y)).toBe(Math.round(author!.y));
	await expect(row.locator('[data-col="author"]')).toHaveText('Andrew Nathenson');
	await expect(row.locator('[data-col="kind"]')).toHaveText('Teensyville');
	// Author and Type keep their sort and filter.
	await expect(table.getByRole('button', { name: 'Filter Author' })).toBeVisible();
	await expect(table.getByRole('button', { name: 'Filter Type' })).toBeVisible();
	await row.screenshot({ path: 'test-results/search-row-phone.png' });
	await page.locator('main').screenshot({ path: 'test-results/search-phone.png' });
	await noSidewaysScroll(page);
});

test('Sources: All Sources by default, each group behind its caret, every source a toggle', async ({
	page
}) => {
	await page.goto('/scripts');
	await page.evaluate(() => {
		localStorage.setItem('e2e:app-sources', '1');
		localStorage.removeItem('grim-games:scripts:sources');
	});
	await page.reload();
	await expect(sourcePicker(page)).toContainText('All Sources');
	await sourcePicker(page).tap();
	const menu = sourceMenu(page);
	await expect(menu.getByRole('checkbox', { name: 'All Sources' })).toBeChecked();
	// Each group's sources stay hidden until its caret opens them.
	await expect(menu.getByText('BotC Scripts', { exact: true })).toBeHidden();
	await menu.getByRole('button', { name: 'Search engines', exact: true }).tap();
	for (const name of ['BotC Scripts', 'BOTC HomeBrew Wiki', 'Bloodstar Clocktica']) {
		await expect(menu.getByRole('checkbox', { name, exact: true })).toBeChecked();
	}
	await expect(menu.getByText('Carousel Script Collection', { exact: true })).toBeHidden();

	// A whole group off, then one of its sources back on.
	const engines = menu.getByRole('checkbox', { name: 'Search engines', exact: true });
	await menu.locator('.aside').first().locator('[data-part="control"]').tap();
	await expect(engines).not.toBeChecked();
	await expect(menu.getByRole('checkbox', { name: 'All Sources' })).not.toBeChecked();
	await menu.getByText('Bloodstar Clocktica', { exact: true }).tap();
	await expect(menu.getByRole('checkbox', { name: 'Bloodstar Clocktica' })).toBeChecked();
	await page.keyboard.press('Escape');
	// Five collections and Bloodstar; remembered on the device.
	await expect(sourcePicker(page)).toContainText('6 sources');
	await page.reload();
	await expect(sourcePicker(page)).toContainText('6 sources');
	await noSidewaysScroll(page);
});

test('Search lists every source on in one table, once they have all answered', async ({
	page
}, testInfo) => {
	const hamletScript = [
		{ id: '_meta', name: 'Little Hamlet', author: 'TPI' },
		'washerwoman',
		'imp'
	];
	let answerBotc: () => void = () => {};
	const botcAnswered = new Promise<void>((resolve) => (answerBotc = resolve));
	await page.route(/\/api\/botcscripts\/search\?/, async (route) => {
		await botcAnswered;
		await route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 77,
						versionId: 77,
						name: 'From The Site',
						version: '1.0.0',
						author: 'Someone',
						score: 3,
						type: 'Full',
						characters: []
					}
				]
			}
		});
	});
	await page.route('**/api/curated', (route) =>
		route.fulfill({
			json: {
				scripts: [
					{
						section: 'recommended',
						link: scriptToolLink(hamletScript),
						json: hamletScript
					}
				]
			}
		})
	);
	await page.route('**/api/bloodstar', (route) => route.fulfill({ status: 503 }));
	await page.goto('/scripts');
	await chooseSource(page, 'BotC Scripts');
	await openSources(page);
	for (const name of ['Official custom scripts', 'Bloodstar Clocktica']) {
		await sourceMenu(page).getByText(name, { exact: true }).tap();
	}
	await page.keyboard.press('Escape');
	await expect(sourcePicker(page)).toContainText('3 sources');

	// Nothing is listed while BotC Scripts is still searching.
	const status = page.getByTestId('picker-status');
	await expect(status).toHaveText('Searching BotC Scripts…');
	const table = page.getByRole('table', { name: 'Scripts' });
	await expect(table.locator('button.pick')).toHaveCount(0);
	answerBotc();
	// Then every row at once, each with its Source; a failed source is named, not waited for.
	await expect(status).toHaveText('2 scripts · Bloodstar Clocktica could not be reached');
	await expect(table.locator('button.pick')).toHaveCount(2);
	// Source gives way on a phone, like Chars.
	if (testInfo.project.name !== 'phone') {
		const hamlet = table.locator('tbody tr', { hasText: 'Little Hamlet' });
		await expect(hamlet.locator('[data-col="source"]')).toHaveText('Official');
		const site = table.locator('tbody tr', { hasText: 'From The Site' });
		await expect(site.locator('[data-col="source"]')).toHaveText('BotC Scripts');
	}
	await noSidewaysScroll(page);
});

test('rows scrolled under the table header stay under it', async ({ page }) => {
	const scripts = Array.from({ length: 17 }, (_, i) => ({
		user: 'someone',
		edition: `Script_${i}`
	}));
	await page.route('**/api/bloodstar', (route) => route.fulfill({ json: { scripts } }));
	await page.goto('/scripts');
	await chooseSource(page, 'Bloodstar Clocktica');
	await expect(page.getByTestId('picker-status')).toHaveText('17 scripts');
	// Trevor, 2026-10-18: names went over the column headers while scrolling.
	await page.locator('.data-table .scroll').evaluate((box) => (box.scrollTop = 70));
	const over = await page
		.getByRole('table', { name: 'Scripts' })
		.locator('thead')
		.evaluate(async (head) => {
			await new Promise((resolve) => requestAnimationFrame(resolve));
			const box = head.getBoundingClientRect();
			const found: string[] = [];
			for (let x = box.left + 4; x < box.right; x += 8) {
				const hit = document.elementFromPoint(x, box.top + box.height / 3);
				if (hit && !head.contains(hit)) found.push(`${hit.tagName}.${hit.className} at ${x}`);
			}
			return found;
		});
	expect(over).toEqual([]);
});

test('turning on a source with a list kept from an earlier visit shows it, without an error', async ({
	page
}) => {
	// Trevor (2026-10-19): reading a kept list for the first time while the table worked out
	// what to show wrote state there (svelte state_unsafe_mutation).
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	const hamletScript = [
		{ id: '_meta', name: 'Little Hamlet', author: 'TPI' },
		'washerwoman',
		'imp'
	];
	const kept = {
		scripts: [{ section: 'recommended', link: scriptToolLink(hamletScript), json: hamletScript }]
	};
	await page.addInitScript(
		(list) => localStorage.setItem('grim-games.curated-scripts', JSON.stringify(list)),
		kept
	);
	await page.route('**/api/curated', (route) => route.fulfill({ json: kept }));
	await page.goto('/scripts');
	await expect(page.getByTestId('picker-status')).toHaveText('None');
	await openSources(page);
	await sourceMenu(page).getByText('Official custom scripts', { exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('table', { name: 'Scripts' })).toContainText('Little Hamlet');
	expect(errors).toEqual([]);
});

test('saving and un-saving an official script leaves its source as it was', async ({ page }) => {
	// Written as the official site writes them: objects and old ids, which saving rewrites.
	const json = [
		{ id: '_meta', name: 'Probe Script', author: 'Someone' },
		{ id: 'washerwoman' },
		'librarian',
		'fortune_teller',
		{ id: 'imp' }
	];
	await page.route('**/api/curated', (route) =>
		route.fulfill({
			json: { scripts: [{ section: 'recommended', link: scriptToolLink(json), json }] }
		})
	);
	await page.goto('/scripts');
	await chooseSource(page, 'Official custom scripts');
	await page.getByRole('button', { name: /^Probe Script/ }).tap();
	// The heading and every fact above the characters (Source among them).
	const summary = async () => {
		const text = await page.getByTestId('script-details').innerText();
		return text.slice(0, text.indexOf('Characters'));
	};
	await expect(details(page).getByRole('link', { name: 'Recommended' })).toBeVisible();
	const before = await summary();
	expect(before).toContain('Official');

	await saveToggle(page).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(summary).toBe(before);
	await expect(page.getByRole('row').filter({ hasText: 'Probe Script' })).toHaveCount(1);

	await saveToggle(page).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(saveToggle(page)).toHaveAttribute('aria-pressed', 'false');
	await expect.poll(summary).toBe(before);
});

test("Print lists the PDF a script's source publishes, as a link", async ({ page }) => {
	const content = [{ id: '_meta', name: 'Storm Front', author: 'Trevor' }, ...homebrew.slice(1)];
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 1900,
						versionId: 900,
						name: 'Storm Front',
						version: '1.0.0',
						author: 'Trevor',
						type: 'Full',
						score: 5,
						characters: [{ id: 'chef' }, { id: 'imp' }]
					}
				]
			}
		})
	);
	await page.route('**/api/botcscripts/versions/1900', (route) =>
		route.fulfill({ json: { scriptId: 1900, latest: '1.0.0', versions: ['1.0.0'] } })
	);
	// The author uploaded a PDF of this version.
	await page.route(/\/api\/botcscripts\/(version\/900|script\/1900\/1\.0\.0)$/, (route) =>
		route.fulfill({
			json: {
				scriptId: 1900,
				versionId: 900,
				name: 'Storm Front',
				version: '1.0.0',
				author: 'Trevor',
				content,
				pdf: true
			}
		})
	);
	const pdfLink = async () => {
		await details(page).getByRole('button', { name: 'Print script' }).tap();
		const routes = page.getByRole('dialog', { name: 'Print script' });
		const link = routes.getByRole('link', { name: 'Script PDF' });
		const href = await link.getAttribute('href');
		await expect(link).toHaveAttribute('target', '_blank');
		await page.keyboard.press('Escape');
		await expect(routes).toBeHidden();
		return href;
	};
	await page.goto('/scripts');
	await page.getByRole('button', { name: /^Storm Front/ }).tap();
	await expect(page.getByTestId('script-sheet')).toBeVisible();
	expect(await pdfLink()).toBe('https://botcscripts.com/script/1900/1.0.0/download_pdf');

	// The Carousel's "Script PDF" on Drive.
	const pdf = 'https://drive.google.com/file/d/1d-ToSIRLvPfyQgwGX_rdSjfNwbigX1tH/view';
	await page.route('**/api/collections/*', (route) =>
		route.fulfill({
			json: {
				scripts: [
					{
						link: 'https://drive.google.com/file/d/1AVrIxWsrBMlATsoU-2M5X03jGeBaJYJb/view',
						page: 'https://docs.google.com/document/d/x/edit#heading=h.a',
						json: [{ id: '_meta', name: 'Carousel Ride', author: 'Someone' }, 'chef', 'imp'],
						pdf
					}
				]
			}
		})
	);
	await backToList(page);
	await chooseSource(page, 'Carousel Script Collection');
	await page.getByRole('button', { name: /^Carousel Ride/ }).tap();
	await expect(detailsName(page)).toHaveText('Carousel Ride');
	expect(await pdfLink()).toBe(pdf);
});
