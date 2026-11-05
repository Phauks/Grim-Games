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
	await page.getByTestId('photo-input').setInputFiles({
		name: 'script.jpg',
		mimeType: 'image/jpeg',
		buffer
	});
	return page.getByRole('dialog', { name: 'Script from a photo' });
}

test.describe.configure({ timeout: 120_000 });

test('a photo of Trouble Brewing is read on the device and loads Trouble Brewing', async ({
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
	await expect(dialog.getByTestId('photo-banner')).toContainText('Looks like Trouble Brewing', {
		timeout: 90_000
	});
	for (const r of tb) await expect(dialog.locator(`[data-character="${r.id}"]`)).toBeVisible();
	await expect(dialog.getByText('None', { exact: true })).toBeVisible();
	await dialog.getByRole('button', { name: 'Load Trouble Brewing' }).tap();
	await expect(dialog).toHaveCount(0);
	// An official edition isn't a Library item; it is the script in use, as players see it.
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
	const dialog = await takePhoto(page, await photo(browser, 'Storm Front', rows));
	await expect(dialog.getByTestId('photo-banner')).toContainText('Storm Front', {
		timeout: 90_000
	});
	await expect(dialog.getByTestId('photo-pick')).toBeVisible();
	await expect(dialog.getByText('Read: "Lamplighter"')).toBeVisible();
	// Untick the Monk: it stays in the list, ticked off, and is left out of the script.
	await dialog.locator('[data-character="monk"]').getByRole('button').first().tap();
	await dialog.getByRole('button', { name: 'Add script' }).tap();
	const opened = page
		.getByRole('dialog', { name: 'Storm Front' })
		.or(page.getByRole('region', { name: 'Storm Front' }));
	await expect(opened).toBeVisible();
	await expect(opened.getByText('Chef', { exact: true }).first()).toBeVisible();
	await expect(opened.getByText('Monk', { exact: true })).toHaveCount(0);
});

test("a sheet with its script's QR code loads that exact script", async ({ page, browser }) => {
	const own = new URL(test.info().project.use.baseURL ?? '').origin;
	const rows = tb.slice(0, 4).map((r) => ({ name: r.name, ability: r.ability ?? '' }));
	await takePhoto(page, await photo(browser, 'Printed Sheet', rows, `${own}/play#e=bmr`));
	await expect(page).toHaveURL(/\/play/, { timeout: 30_000 });
	await expect(page.getByRole('heading', { name: 'Bad Moon Rising' }).first()).toBeVisible();
});
