import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

// Take a Photo's live scan (Trevor, 2026-11-10; out of its spike 2026-11-18): the camera runs,
// the picture is taken once the sheet's corners are steady and it is sharp, held, straightened
// and read, then reviewed like a photo, with a scan again offered only when something looked
// wrong. The camera here is a pretend one: a printed sheet, photographed, shaking a little.

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

/** A printed sheet on a table, as a picture: the title, then each character and ability. */
async function sheet(browser: Browser, title: string, rows: readonly Role[]): Promise<string> {
	const context = await browser.newContext({ viewport: { width: 1100, height: 1500 } });
	const maker = await context.newPage();
	const lines = rows
		.map((r) => `<div class="r"><b>${r.name}</b><span>${r.ability ?? ''}</span></div>`)
		.join('');
	await maker.setContent(
		`<body style="margin:0;background:#4a3b2c;display:grid;place-items:center;height:1500px">
		<div style="width:960px;background:#f1e8d4;padding:30px 40px;font-family:Georgia,serif;color:#222;transform:rotate(-2deg)">
		<h1 style="text-align:center;font-size:52px;margin:0 0 10px">${title}</h1>${lines}</div>
		<style>.r{display:flex;gap:14px;margin:8px 0;font-size:18px}.r b{width:190px;flex:none;font-size:21px}</style></body>`
	);
	const shot = await maker.screenshot({ type: 'jpeg', quality: 90 });
	await context.close();
	return `data:image/jpeg;base64,${shot.toString('base64')}`;
}

/** The phone's camera, pretended: the sheet drawn into a video stream, moving a pixel or two. */
async function pretendCamera(page: Page, picture: string) {
	await page.addInitScript((src) => {
		navigator.mediaDevices.getUserMedia = async () => {
			const image = new Image();
			image.src = src;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.width;
			canvas.height = image.height;
			const ctx = canvas.getContext('2d')!;
			let n = 0;
			const draw = () => {
				n++;
				ctx.drawImage(image, Math.sin(n / 7), Math.cos(n / 9));
				requestAnimationFrame(draw);
			};
			draw();
			return canvas.captureStream(30);
		};
	}, picture);
}

async function takeAPhoto(page: Page) {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	await page.getByRole('button', { name: 'Take a Photo', exact: true }).tap();
	return page.getByRole('dialog', { name: 'Take a Photo' });
}

test.describe.configure({ timeout: 120_000 });

test('Take a Photo takes the picture once the sheet is steady, and reviews what it read', async ({
	page,
	browser
}) => {
	await pretendCamera(page, await sheet(browser, 'Trouble Brewing', tb));
	const scan = await takeAPhoto(page);
	await expect(scan.getByTestId('live-scan-status')).toBeVisible();
	const review = page.getByRole('dialog', { name: 'Script from a photo' });
	// The reader sometimes drops the title's last letter; the title's own reading is checked in the matcher's tests.
	await expect(review.getByRole('textbox', { name: 'Name' })).toHaveValue(/^Trouble Brewin/, {
		timeout: 90_000
	});
	await expect(scan).toHaveCount(0);
	for (const r of tb) await expect(review.locator(`[data-character="${r.id}"]`)).toBeVisible();
	await expect(review.getByTestId('live-scan-issues')).toHaveCount(0);
	// The picture taken, straightened, with each line read marked (Trevor, 2026-11-15).
	await review.getByRole('button', { name: 'Pictures Read' }).tap();
	const shown = page.getByRole('dialog', { name: 'Pictures Read' });
	await expect(shown.locator('rect[data-mark="character"]').first()).toBeAttached();
	await shown.getByRole('button', { name: 'Close' }).tap();
	// How it was taken, for the read log (Trevor, 2026-11-10: diagnostics to copy).
	await review.getByRole('button', { name: 'Read Log' }).tap();
	const log = page.getByRole('dialog', { name: 'Import Log' }).getByTestId('import-log');
	await expect(log).toContainText('Picture taken when steady');
	await expect(log).toContainText('Straightened to');
});

test('a picture with problems says so and offers a scan again; Take Picture takes one at once', async ({
	page,
	browser
}) => {
	await pretendCamera(page, await sheet(browser, 'Short Sheet', tb.slice(0, 3)));
	let scan = await takeAPhoto(page);
	await scan.getByRole('button', { name: 'Take Picture' }).tap();
	const review = page.getByRole('dialog', { name: 'Script from a photo' });
	const issues = review.getByTestId('live-scan-issues');
	await expect(issues).toContainText('Only 3 characters read.', { timeout: 90_000 });
	await issues.getByRole('button', { name: 'Scan again' }).tap();
	scan = page.getByRole('dialog', { name: 'Take a Photo' });
	await expect(scan.getByTestId('live-scan-status')).toBeVisible();
	await expect(review).toHaveCount(0);
});

test("with no camera to give, the phone's camera app is offered", async ({ page }) => {
	await page.addInitScript(() => {
		navigator.mediaDevices.getUserMedia = () =>
			Promise.reject(new DOMException('No camera', 'NotFoundError'));
	});
	const scan = await takeAPhoto(page);
	await expect(scan.getByRole('alert')).toContainText('The camera did not start (NotFoundError).');
	await expect(scan.getByRole('button', { name: 'Use the Camera App' })).toBeVisible();
	await expect(scan.getByRole('button', { name: 'Take Picture' })).toBeDisabled();
});
