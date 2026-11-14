import { readFileSync } from 'node:fs';
import { expect, test, type Browser } from '@playwright/test';

// Live scan spike (Trevor, 2026-11-10): the pretend camera's sheet, held with a hand's shake,
// is grabbed once its corners are steady, straightened into a flat page and read once; the
// frame is then held and the review opens, asking for a scan again only when something looked
// wrong. Take picture grabs at once. The fade-while-moving way stays behind the switch.
test.describe.configure({ timeout: 120_000 });

test('a shaky sheet is grabbed once, straightened and read, then held for review', async ({
	page
}) => {
	await page.goto('/spikes/live-scan');
	// The same review as a photo's (Trevor, 2026-11-14).
	const review = page.getByRole('dialog', { name: 'Script from a photo' });
	await expect(review.getByRole('textbox', { name: 'Name' })).toHaveValue('Trouble Brewing', {
		timeout: 90_000
	});
	await expect(review).toContainText('Washerwoman');
	await expect(page.getByTestId('live-scan-page')).toBeVisible();
	// Held, and said so, so the phone can move (Trevor, 2026-11-10).
	await expect(page.getByTestId('live-scan-taken')).toContainText('Picture taken. You can move.');
	await expect(page.getByText('1 reads')).toBeVisible();
	await page.keyboard.press('Escape');
	// Held: no second read starts.
	await page.waitForTimeout(3000);
	await expect(page.getByText('1 reads')).toBeVisible();
	await expect(page.getByTestId('live-scan-status')).toHaveText(/^Read/);
	// What happened, to copy and send.
	await expect(page.getByRole('button', { name: 'Copy diagnostics' })).toBeEnabled();
	await expect(page.getByRole('button', { name: 'Save pictures' })).toBeEnabled();
	await page.getByRole('button', { name: 'Scan again' }).last().tap();
	await expect(page.getByTestId('live-scan-banner')).toHaveText('Nothing read yet');
	await expect(page.getByTestId('live-scan-taken')).toBeHidden();
	// A picture taken by hand (Trevor, 2026-11-10), in case the auto-grab has difficulties.
	await page.getByRole('button', { name: 'Take picture' }).tap();
	await expect(review).toContainText('Washerwoman', { timeout: 30_000 });
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Scan again' }).last().tap();
	await page.getByText('Corner tracking', { exact: true }).tap();
	await expect(page.getByText('Off: marks fade while the picture moves')).toBeVisible();
});

interface Role {
	id: string;
	name: string;
	edition?: string;
	ability?: string;
}
const roles = JSON.parse(readFileSync('static/data/roles.json', 'utf8')) as Role[];
const ability = (id: string) => roles.find((r) => r.id === id)?.ability ?? '';

/** A printed custom sheet with type headings, two characters the app doesn't know, and a night order. */
async function customSheet(browser: Browser): Promise<Buffer> {
	const context = await browser.newContext({ viewport: { width: 1100, height: 1500 } });
	const maker = await context.newPage();
	const row = (name: string, text: string) =>
		`<div class="r"><b>${name}</b><span>${text}</span></div>`;
	const head = (text: string) => `<h2>${text}</h2>`;
	await maker.setContent(
		`<body style="margin:0;background:#4a3b2c;display:grid;place-items:center;height:1500px">
		<div style="width:960px;background:#f1e8d4;padding:30px 40px;font-family:Georgia,serif;color:#222;transform:rotate(-2deg)">
		<h1 style="text-align:center;font-size:52px;margin:0 0 10px">Storm Front</h1>
		${head('Townsfolk')}${row('Chef', ability('chef'))}${row('Empath', ability('empath'))}
		${row('Lamplighter', 'Each night, choose a player: you learn whether they were nominated today.')}
		${head('Outsiders')}${row('Bellringer', 'If you die by day, the Demon learns who you are.')}
		${head('Minions')}${row('Poisoner', ability('poisoner'))}${head('Demons')}${row('Imp', ability('imp'))}
		${head('First Night')}<p>Dusk</p><p>Minion Info</p><p>Demon Info</p><p>Poisoner</p><p>Lamplighter</p><p>Chef</p><p>Empath</p><p>Dawn</p>
		</div><style>.r{display:flex;gap:14px;margin:8px 0;font-size:18px}.r b{width:190px;flex:none;font-size:21px}h2{font-size:24px;margin:14px 0 4px}p{margin:4px 0;font-size:20px}</style></body>`
	);
	const shot = await maker.screenshot({ type: 'jpeg', quality: 90, fullPage: true });
	await context.close();
	return shot;
}

test('an uploaded picture of a custom sheet adds its custom characters and night order', async ({
	page,
	browser
}) => {
	// Trevor, 2026-11-14: "Allow me to upload a picture in the spike"; A, a Custom characters
	// switch in the review; "scan night order if available".
	const sheet = await customSheet(browser);
	await page.goto('/spikes/live-scan');
	await page.getByRole('button', { name: 'Upload picture' }).tap();
	await page
		.getByTestId('live-scan-upload')
		.setInputFiles({ name: 'sheet.jpg', mimeType: 'image/jpeg', buffer: sheet });
	const review = page.getByRole('dialog', { name: 'Script from a photo' });
	await expect(review.getByRole('textbox', { name: 'Name' })).toHaveValue('Storm Front', {
		timeout: 90_000
	});
	// Off: the names the app doesn't know wait under Not matched, as before.
	await expect(review.getByText('Read: "Bellringer"')).toBeVisible();
	await expect(review.getByTestId('new-mark')).toHaveCount(0);
	await review.getByText('Custom characters', { exact: true }).tap();
	await expect(review.getByTestId('new-mark')).toHaveCount(2);
	await expect(review.locator('[data-character="bellringer"]')).toContainText(
		'the Demon learns who you are'
	);
	await expect(review.getByText('Read: "Bellringer"')).toHaveCount(0);
	await expect(review.getByTestId('photo-banner')).toContainText('2 new, night order read');
	await review.getByRole('button', { name: 'Add script' }).tap();
	await expect(page).toHaveURL(/\/library/);
	// The script in use carries the new characters with the abilities read (its night order
	// from the sheet is checked in script-photo.test.ts).
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Storm Front' }).first()).toBeVisible();
	await expect(page.getByText('Bellringer', { exact: true }).first()).toBeVisible();
});
