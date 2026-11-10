import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { renderSVG } from 'uqr';

// Plan M54 (Trevor, 2026-11-05): "take a picture of a script ... suddenly it's all loaded in
// the app", read on the device ("build it into the app for local analysis"), reviewed as a list
// (he picked layout 3A). The photos are drawn here from TPI's character data, a little tilted.

interface Role {
	id: string;
	name: string;
	team: string;
	edition?: string;
	ability?: string;
}

const roles = JSON.parse(readFileSync('static/data/roles.json', 'utf8')) as Role[];
const PLAYABLE = ['townsfolk', 'outsider', 'minion', 'demon'];
const tb = roles.filter((r) => r.edition === 'tb' && PLAYABLE.includes(r.team));

/** A printed script sheet, photographed: the title, then each character's name and ability. */
async function photo(
	browser: Browser,
	title: string,
	rows: readonly { name: string; ability: string }[],
	qr = ''
): Promise<Buffer> {
	const context = await browser.newContext({ viewport: { width: 1100, height: 1500 } });
	const page = await context.newPage();
	const lines = rows
		.map((r) => `<div class="r"><b>${r.name}</b><span>${r.ability}</span></div>`)
		.join('');
	await page.setContent(
		`<body style="margin:0;background:#4a3b2c;display:grid;place-items:center;height:1500px">
		<div style="width:960px;background:#f1e8d4;padding:30px 40px;font-family:Georgia,serif;color:#222;transform:rotate(-2deg)">
		<h1 style="text-align:center;font-size:52px;margin:0 0 10px">${title}</h1>${lines}${qr && `<div style="width:220px;margin:20px auto 0">${renderSVG(qr)}</div>`}</div>
		<style>.r{display:flex;gap:14px;margin:8px 0;font-size:18px}.r b{width:190px;flex:none;font-size:21px}</style></body>`
	);
	const shot = await page.screenshot({ type: 'jpeg', quality: 85 });
	await context.close();
	return shot;
}

async function takePhoto(page: Page, buffer: Buffer) {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	await expect(page.getByRole('button', { name: 'Take a Photo' })).toBeVisible();
	return readPhoto(page, buffer);
}

async function readPhoto(page: Page, buffer: Buffer) {
	// The first: the screen's own Take a Photo (the script sheet's Add script holds another).
	await page.getByTestId('photo-input').first().setInputFiles({
		name: 'script.jpg',
		mimeType: 'image/jpeg',
		buffer
	});
	return page.getByRole('dialog', { name: 'Script from a photo' });
}

test.describe.configure({ timeout: 120_000 });

test('a photo of Trouble Brewing is read on the device and added as the script it shows', async ({
	page,
	browser
}) => {
	const sheet = await photo(
		browser,
		'Trouble Brewing',
		tb.map((r) => ({ name: r.name, ability: r.ability ?? '' }))
	);
	// Nothing is sent anywhere: every request stays on the app's own address.
	const own = new URL(test.info().project.use.baseURL ?? '').origin;
	const elsewhere: string[] = [];
	page.on('request', (r) => {
		const url = new URL(r.url());
		if (url.protocol.startsWith('http') && url.origin !== own) elsewhere.push(url.origin);
	});
	const dialog = await takePhoto(page, sheet);
	await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Trouble Brewing', {
		timeout: 90_000
	});
	for (const r of tb) await expect(dialog.locator(`[data-character="${r.id}"]`)).toBeVisible();
	await expect(dialog.getByText('None', { exact: true })).toBeVisible();
	// Never swapped for the known edition (Trevor, 2026-11-10): the characters read, named from
	// the sheet's title, become the script in use.
	await dialog.getByRole('button', { name: 'Add script' }).tap();
	await expect(dialog).toHaveCount(0);
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Trouble Brewing' }).first()).toBeVisible();
	expect(elsewhere).toEqual([]);
});

test('a custom sheet keeps only what is ticked and names it from its title', async ({
	page,
	browser
}) => {
	const pick = ['washerwoman', 'chef', 'empath', 'monk', 'saint', 'poisoner', 'imp'];
	const rows = pick.map((id) => {
		const r = tb.find((c) => c.id === id)!;
		return { name: r.name, ability: r.ability ?? '' };
	});
	rows.splice(3, 0, { name: 'Lamplighter', ability: '' });
	// The byline names the author (Trevor, 2026-11-06: "By: XXX should recognize as the author").
	rows.unshift({ name: 'By: Trevor', ability: '' });
	const dialog = await takePhoto(page, await photo(browser, 'Storm Front', rows));
	await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Storm Front', {
		timeout: 90_000
	});
	await expect(dialog.getByRole('textbox', { name: 'Author' })).toHaveValue('Trevor');
	// A misread name, author or version is fixed here (Trevor, 2026-11-10).
	await dialog.getByRole('textbox', { name: 'Name' }).fill('Storm Front Remix');
	await expect(dialog.getByTestId('photo-pick')).toBeVisible();
	await expect(dialog.getByText('Read: "Lamplighter"')).toBeVisible();
	// Untick the Monk: it stays in the list, ticked off, and is left out of the script.
	await dialog.locator('[data-character="monk"]').getByRole('button').first().tap();
	await dialog.getByRole('button', { name: 'Add script' }).tap();
	const opened = page
		.getByRole('dialog', { name: 'Storm Front Remix' })
		.or(page.getByRole('region', { name: 'Storm Front Remix' }));
	await expect(opened).toBeVisible();
	await expect(opened.getByText('Chef', { exact: true }).first()).toBeVisible();
	await expect(opened.getByText('Monk', { exact: true })).toHaveCount(0);
	// Each character comes with its ability (Trevor, 2026-11-06: they loaded without one).
	const chef = tb.find((c) => c.id === 'chef')!;
	await expect(opened.getByTestId('script-sheet')).toContainText(chef.ability ?? '');
	await expect(opened.getByTestId('script-details').getByRole('definition').first()).toHaveText(
		'Trevor'
	);
});

test("a sheet with its script's QR code loads that exact script", async ({ page, browser }) => {
	const own = new URL(test.info().project.use.baseURL ?? '').origin;
	const rows = tb.slice(0, 4).map((r) => ({ name: r.name, ability: r.ability ?? '' }));
	await takePhoto(page, await photo(browser, 'Printed Sheet', rows, `${own}/play#e=bmr`));
	await expect(page).toHaveURL(/\/play/, { timeout: 30_000 });
	await expect(page.getByRole('heading', { name: 'Bad Moon Rising' }).first()).toBeVisible();
});

test('a player with no script yet starts from a photo on the play screen', async ({
	page,
	browser
}) => {
	// Trevor, 2026-11-05: Take a Photo easy to see where a players-only game starts.
	const sheet = await photo(
		browser,
		'Trouble Brewing',
		tb.map((r) => ({ name: r.name, ability: r.ability ?? '' }))
	);
	await page.goto('/play');
	const choose = page.getByRole('region', { name: 'Choose a script' });
	await expect(choose.getByRole('button', { name: 'Take a Photo' })).toBeVisible();
	await expect(choose.getByRole('button', { name: 'Choose a Photo' })).toBeVisible();
	const dialog = await readPhoto(page, sheet);
	await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Trouble Brewing', {
		timeout: 90_000
	});
	await dialog.getByRole('button', { name: 'Add script' }).tap();
	await expect(dialog).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Trouble Brewing' }).first()).toBeVisible();
	await expect(page.getByRole('tab', { name: 'Grim' })).toBeVisible();
});

test("a script sheet's PDF is read from its own text, through Upload File", async ({
	page,
	browser
}) => {
	// Trevor, 2026-11-05: a PDF given to the photo reader did nothing.
	const context = await browser.newContext();
	const maker = await context.newPage();
	const rows = tb.map((r) => `<p><b>${r.name}</b> ${r.ability ?? ''}</p>`).join('');
	await maker.setContent(`<h1 style="font-size:40px">Trouble Brewing</h1>${rows}`);
	const pdf = await maker.pdf({ format: 'A4' });
	await context.close();
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	await page
		.getByLabel('Script file', { exact: true })
		.setInputFiles({ name: 'script.pdf', mimeType: 'application/pdf', buffer: pdf });
	const dialog = page.getByRole('dialog', { name: 'Script from a photo' });
	await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Trouble Brewing', {
		timeout: 60_000
	});
	for (const r of tb) await expect(dialog.locator(`[data-character="${r.id}"]`)).toBeVisible();
});

test('Choose a Photo reads a saved picture, and Read Log tells each step', async ({
	page,
	browser
}) => {
	// Trevor, 2026-11-06: "take a photo means take a photo"; three buttons (A); and "We need
	// more verbose logging of what is happening".
	const sheet = await photo(
		browser,
		'Trouble Brewing',
		tb.map((r) => ({ name: r.name, ability: r.ability ?? '' }))
	);
	const printed: string[] = [];
	page.on('console', (m) => {
		if (m.text().startsWith('[script-import]')) printed.push(m.text());
	});
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const add = page.getByRole('dialog', { name: 'Add script' });
	for (const name of ['Upload File', 'Take a Photo', 'Choose a Photo']) {
		await expect(add.getByRole('button', { name, exact: true })).toBeVisible();
	}
	// Take a Photo goes straight to the camera; Choose a Photo to the photos.
	await expect(page.getByTestId('photo-input')).toHaveAttribute('capture', 'environment');
	await expect(page.getByTestId('photo-library-input')).not.toHaveAttribute('capture');
	await page.getByTestId('photo-library-input').setInputFiles({
		name: 'saved.jpg',
		mimeType: 'image/jpeg',
		buffer: sheet
	});
	const dialog = page.getByRole('dialog', { name: 'Script from a photo' });
	await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Trouble Brewing', {
		timeout: 90_000
	});
	await dialog.getByRole('button', { name: 'Read Log' }).tap();
	const log = page.getByRole('dialog', { name: 'Import Log' }).getByTestId('import-log');
	await expect(log).toContainText('Photo received: saved.jpg, image/jpeg');
	await expect(log).toContainText('No QR code on page 1');
	await expect(log).toContainText('Washerwoman by name');
	await expect(log).toContainText('title "Trouble Brewing"');
	expect(printed.some((p) => p.includes('Photo received: saved.jpg'))).toBe(true);
	await page
		.getByRole('dialog', { name: 'Import Log' })
		.getByRole('button', { name: 'Close' })
		.tap();
	await expect(dialog).toBeVisible();
});

test('a picture of a sheet given to Upload File is read like a photo', async ({
	page,
	browser
}) => {
	const sheet = await photo(
		browser,
		'Trouble Brewing',
		tb.map((r) => ({ name: r.name, ability: r.ability ?? '' }))
	);
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	await page
		.getByLabel('Script file', { exact: true })
		.setInputFiles({ name: 'sheet.jpg', mimeType: 'image/jpeg', buffer: sheet });
	const dialog = page.getByRole('dialog', { name: 'Script from a photo' });
	await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Trouble Brewing', {
		timeout: 90_000
	});
});
