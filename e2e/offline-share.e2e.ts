import { expect, test, type Browser, type TestInfo } from '@playwright/test';
import { renderSVG } from 'uqr';
import { encodeSharedScript, offlineCode } from '../src/lib/features/scripts/share.ts';
import { aimCamera, qrSrc } from './camera.ts';

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
	const share = page.getByRole('dialog', { name: 'Share Pocket Brew' });
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
	const share = page.getByRole('dialog', { name: 'Share Long Homebrew' });
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
