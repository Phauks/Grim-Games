import { expect, test, type Browser, type TestInfo } from '@playwright/test';
import { renderSVG } from 'uqr';
import { encodeSharedScript, offlineCode } from '../src/lib/features/scripts/share.ts';
import { aimCamera, qrSrc } from './camera.ts';
import { toBoard } from './new-game.ts';

// Offline games (Trevor, 2026-10-26): a Storyteller with no internet gets the script to phones
// with no internet through a QR code the app's own scanner reads, one code or an animated
// one, and the phone says the game is offline with only the script.

const short = [{ id: '_meta', name: 'Pocket Brew', author: 'Trevor' }, 'chef', 'empath', 'imp'];
/** Homebrew with its own text, which doesn't compress much: too long for one code. */
const long = [
	{ id: '_meta', name: 'Long Homebrew', author: 'Trevor' },
	...Array.from({ length: 30 }, (_, i) => ({
		id: `ownchar${i}`,
		name: `Own Character ${i}`,
		team: i % 4 === 3 ? 'minion' : 'townsfolk',
		ability: `Each night, learn ${crypto.randomUUID()} or ${crypto.randomUUID()}.`
	})),
	'imp'
];

/** A phone, its camera on `srcs`, scanning on Join game with no internet. */
async function scanOffline(browser: Browser, testInfo: TestInfo, srcs: string | string[]) {
	const context = await browser.newContext({ ...testInfo.project.use });
	const phone = await context.newPage();
	await aimCamera(phone, srcs);
	await phone.goto('/join');
	await phone.evaluate(() => navigator.serviceWorker.ready);
	await context.setOffline(true);
	await phone.getByRole('button', { name: 'Scan a code' }).tap();
	return { context, phone };
}

test('a Storyteller with no internet shares an offline code, and a phone with none reads it', async ({
	page,
	context,
	browser
}, testInfo) => {
	await page.goto(`/play#s=${await encodeSharedScript(short)}`);
	await expect(page.getByRole('heading', { name: 'Pocket Brew', level: 1 })).toBeVisible();
	await context.setOffline(true);

	await page.getByRole('button', { name: 'Share script' }).tap();
	const share = page.getByRole('dialog', { name: 'Share', exact: true });
	// No short link can be made offline, so the offline code is on by itself.
	await expect(
		share.getByRole('checkbox', { name: /^Offline code/, includeHidden: true })
	).toBeChecked();
	await expect(share.getByTestId('share-url')).toHaveValue(/\/play#s=1\.[\w-]+&o=1$/);
	await expect(share.getByTestId('qr-caption')).toHaveText('Offline: script only');
	const url = await share.getByTestId('share-url').inputValue();
	await context.setOffline(false);

	const { context: phoneContext, phone } = await scanOffline(
		browser,
		testInfo,
		qrSrc(renderSVG(url, { border: 2 }))
	);
	await expect(phone.getByRole('heading', { name: 'Pocket Brew', level: 1 })).toBeVisible({
		timeout: 15_000
	});
	await phone.getByTestId('offline-game').tap();
	const about = phone.getByRole('dialog', { name: 'Offline game' });
	await expect(about).toContainText('Not coming to this phone');
	await phoneContext.close();
});

test('a long script goes across as an animated code', async ({ page, browser }, testInfo) => {
	await page.goto(`/play#s=${await encodeSharedScript(long)}`);
	await expect(page.getByRole('heading', { name: 'Long Homebrew', level: 1 })).toBeVisible();

	await page.getByRole('button', { name: 'Share script' }).tap();
	const share = page.getByRole('dialog', { name: 'Share', exact: true });
	await share.getByText('Offline code', { exact: true }).tap();
	const qr = share.getByRole('img', { name: 'Offline code for Long Homebrew' });
	await expect(qr).toBeVisible();
	// The frames take turns in the QR's place.
	const pattern = qr.getByTestId('qr-pattern');
	const first = await pattern.getAttribute('d');
	await expect.poll(() => pattern.getAttribute('d')).not.toBe(first);

	const code = await offlineCode('https://grimbinder.com', { json: long });
	expect(code.frames!.length).toBeGreaterThan(1);
	const { context, phone } = await scanOffline(
		browser,
		testInfo,
		code.frames!.map((frame) => qrSrc(renderSVG(frame, { border: 2 })))
	);
	await expect(
		phone.getByRole('dialog', { name: 'Scan a code' }).getByRole('status')
	).toContainText(/Reading the code: \d+ of \d+/, { timeout: 15_000 });
	await expect(phone.getByRole('heading', { name: 'Long Homebrew', level: 1 })).toBeVisible({
		timeout: 30_000
	});
	await expect(phone.getByTestId('offline-game')).toBeVisible();
	await context.close();
});

test('a scanned script stays, though the phone was last in a room playing another', async ({
	page,
	browser
}, testInfo) => {
	// Trevor, 2026-10-27: an offline Fall of Rome turned into Bad Moon Rising, the script of the
	// room the phone had joined before, once that room reconnected.
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await page.goto(`${new URL(page.url()).pathname}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const { url } = await offlineCode('https://grimbinder.com', { json: short });
	const context = await browser.newContext({ ...testInfo.project.use });
	const phone = await context.newPage();
	await aimCamera(phone, qrSrc(renderSVG(url, { border: 2 })));
	await phone.goto(`/join/${code}`);
	await expect(phone.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	await phone.goto('/join');
	await phone.getByRole('button', { name: 'Scan a code' }).tap();
	await expect(phone.getByRole('heading', { name: 'Pocket Brew', level: 1 })).toBeVisible({
		timeout: 15_000
	});
	await expect(phone.getByTestId('offline-game')).toBeVisible();
	// The room is still open, but the phone left it, so reopening the app keeps the script.
	await phone.reload();
	await expect(phone.getByRole('heading', { name: 'Pocket Brew', level: 1 })).toBeVisible();
	await expect(phone.getByTestId('you-row')).toHaveCount(0);
	await expect(phone.getByRole('heading', { name: 'Pocket Brew', level: 1 })).toBeVisible();
	// The room is still in Your games, to join again.
	await phone.goto('/join');
	await expect(phone.getByTestId('recent-rooms').getByRole('button')).toHaveCount(1);
	await context.close();
});

test("an animated code's frame opened by the camera app opens the scanner in the app", async ({
	browser
}, testInfo) => {
	// Trevor, 2026-10-27: "tell people to open the grimbinder app". Each frame is a link to Join
	// game, which opens the scanner with that frame in and shows each piece as it arrives.
	const code = await offlineCode('https://grimbinder.com', { json: long });
	const frames = code.frames!;
	const context = await browser.newContext({ ...testInfo.project.use });
	const phone = await context.newPage();
	await aimCamera(
		phone,
		frames.map((frame) => qrSrc(renderSVG(frame, { border: 2 })))
	);
	await phone.goto(`/join${new URL(frames[1]).hash}`);
	const scanner = phone.getByRole('dialog', { name: 'Scan a code' });
	await expect(scanner.getByRole('status')).toContainText(
		/Reading the code: [1-9]\d* of \d+ pieces/
	);
	await expect(scanner.getByRole('status').locator('li.have').first()).toBeVisible();
	await expect(phone.getByRole('heading', { name: 'Long Homebrew', level: 1 })).toBeVisible({
		timeout: 30_000
	});
	await expect(phone.getByTestId('offline-game')).toBeVisible();
	await context.close();
});
