import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';
import { pickNumber } from './number-select.ts';

// Our own printed sheet, from /play's Print (Trevor, 2026-10-19), reworked 2026-10-29: named
// after the app, paper and margins, and a Front and a Back with a switch per item.
const SHEET = `Print ${APP_NAME} Sheet`;

test.beforeEach(async ({ page }) => {
	await page.goto('/play');
	// The first load fetches the character data, slow on a busy machine.
	await expect(page.getByRole('link', { name: 'Find a script' })).toHaveAttribute(
		'href',
		'/scripts',
		{ timeout: 15_000 }
	);
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
});

async function openSheet(page: Page) {
	await page.getByRole('button', { name: 'Print script' }).tap();
	await page
		.getByRole('dialog', { name: 'Print script' })
		.getByRole('button', { name: SHEET })
		.tap();
	const screen = page.getByRole('dialog', { name: SHEET });
	return {
		screen,
		preview: screen.getByTestId('print-preview'),
		fields: screen.getByTestId('print-settings')
	};
}

test('Print script prints the sheet, then the night order and player counts', async ({ page }) => {
	await page.evaluate(() => {
		window.print = () => {
			const w = window as unknown as Record<string, unknown>;
			const sheet = document.querySelector('[data-testid="print-sheet"]');
			w.printed = sheet?.textContent ?? '';
			// "Save as PDF" names and titles the file after the page (Trevor, 2026-10-30).
			w.title = document.title;
			// Each side fits one page (Trevor, 2026-10-18): front in one or two columns.
			w.pages = [
				...document.querySelectorAll<HTMLElement>('[data-testid="print-sheet"] .page')
			].map((p) => ({ fits: p.scrollHeight <= p.clientHeight + 1, columns: p.dataset.columns }));
			// The front's night strips: each night's steps, as icons (Trevor, 2026-10-19).
			w.strips = Object.fromEntries(
				[...document.querySelectorAll<HTMLElement>('.front [data-night-strip]')].map((s) => [
					s.dataset.nightStrip,
					[...s.querySelectorAll<HTMLElement>('[data-step]')].map((li) => li.dataset.step)
				])
			);
			// The paper and margins the print dialog is given.
			w.pageRule = [...document.querySelectorAll('head style')]
				.map((s) => s.textContent ?? '')
				.find((text) => text.includes('@page'));
		};
	});
	await page.getByRole('button', { name: 'Print script' }).tap();
	// Print offers the ways to print (Trevor, 2026-10-19): TPI's Script Tool by a plain link
	// carrying this script, and our own sheet.
	const routes = page.getByRole('dialog', { name: 'Print script' });
	const tool = routes.getByRole('link', { name: 'Open in the official Script Tool' });
	await expect(tool).toHaveAttribute(
		'href',
		/^https:\/\/script\.bloodontheclocktower\.com\/\?script=/
	);
	const href = (await tool.getAttribute('href'))!;
	const json = await page.evaluate(async (link) => {
		const payload = decodeURIComponent(new URL(link).searchParams.get('script')!);
		const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
		const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
		return new Response(stream).text();
	}, href);
	expect(json).toContain('washerwoman');
	await routes.getByRole('button', { name: SHEET }).tap();
	// Our sheet opens its settings beside a preview first (Trevor, 2026-10-19).
	await page
		.getByRole('dialog', { name: SHEET })
		.getByRole('button', { name: 'Print', exact: true })
		.tap();
	// Printing first waits up to five seconds for the sheet and its icons, so poll longer than that.
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { printed?: string }).printed), {
			timeout: 15_000
		})
		.toContain('First night');
	const w = await page.evaluate(() => {
		const { printed, strips, pages, pageRule, title } = window as unknown as Record<
			string,
			unknown
		>;
		return { printed, strips, pages, pageRule, title } as {
			title: string;
			printed: string;
			strips: Record<string, string[]>;
			pages: unknown;
			pageRule: string;
		};
	});
	expect(w.title).toBe('Trouble Brewing');
	expect(w.printed).toContain('Washerwoman');
	expect(w.printed).toContain('Other nights');
	expect(w.printed).not.toContain('Not the first night');
	// Letter with half-inch margins unless chosen otherwise (Trevor, 2026-10-29).
	expect(w.pageRule).toMatch(/size: letter; margin: 12\.7mm/);
	expect(w.strips.first).toContain('washerwoman');
	expect(w.strips.other).not.toContain('washerwoman');
	expect(w.strips.other.length).toBeGreaterThan(0);
	expect(w.pages).toEqual([
		{ fits: true, columns: expect.stringMatching(/^[12]$/) },
		{ fits: true, columns: undefined }
	]);
	// Paper is white to its edges: a dark theme's color-scheme would paint the margins black.
	await page.emulateMedia({ media: 'print' });
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
		'light'
	);
	// The theme's fixed backdrop printed under each page, a dark line at the sheet's edges
	// (Trevor, 2026-10-30).
	expect(await page.evaluate(() => getComputedStyle(document.body, '::before').display)).toBe(
		'none'
	);
	await page.emulateMedia({ media: 'screen' });
	// The page itself is unchanged.
	await expect(page.getByRole('tabpanel', { name: 'Script' })).toBeVisible();
});

// Trevor, 2026-10-19: "our own sheet should open a screen where users can select the various
// settings for the printable"; 2026-10-29: no number of copies, the printer dialog has that.
test('the sheet opens its settings beside a live preview of each numbered page', async ({
	page
}) => {
	await page.evaluate(() => {
		window.print = () => {
			(window as unknown as { pages: number }).pages = document.querySelectorAll(
				'.print-root [data-testid="print-sheet"] .page'
			).length;
		};
	});
	const { screen, preview, fields } = await openSheet(page);
	await expect(screen.getByRole('button', { name: /character sheets/i })).toHaveCount(0);
	// Page 1 is the front and page 2 the back, each labelled over its paper.
	const pages = preview.getByTestId('print-page');
	await expect(pages).toHaveCount(2);
	await expect(pages.nth(0)).toContainText('1Front');
	await expect(pages.nth(1)).toContainText('2Back');
	await expect(screen.getByTestId('print-laying-out')).toBeHidden();
	await expect(preview.locator('.front [data-night-strip]')).toHaveCount(2);
	// Each choice shows in the preview straight away.
	await fields.getByText('Night order down the sides', { exact: true }).tap();
	await expect(preview.locator('[data-night-strip]')).toHaveCount(0);
	await fields.getByText('Jinxes', { exact: true }).first().tap();
	await expect(preview.locator('.front')).not.toContainText('Jinxes');
	// A4 is taller and narrower than Letter.
	const paper = preview.locator('.paper').first();
	const letter = (await paper.boundingBox())!;
	await fields.getByRole('combobox', { name: 'Page size' }).tap();
	await page.getByRole('option', { name: /^A4/ }).tap();
	await expect
		.poll(async () => (await paper.boundingBox())!.height / (await paper.boundingBox())!.width)
		.toBeGreaterThan(letter.height / letter.width + 0.1);
	await screen.getByRole('button', { name: 'Print', exact: true }).tap();
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { pages?: number }).pages), {
			timeout: 15_000
		})
		.toBe(2);
	// Remembered on the device, and also in Settings → Print.
	await page.reload();
	const again = await openSheet(page);
	await expect(
		again.fields.getByRole('checkbox', { name: 'Night order down the sides', includeHidden: true })
	).not.toBeChecked();
	// The preview shrinks to fit; nothing scrolls sideways.
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

// Trevor, 2026-10-29: "margin size should be choosable as inches or mm".
test('margins are picked in eighths of an inch or in millimetres', async ({ page }) => {
	const { fields } = await openSheet(page);
	const margins = fields.getByRole('combobox', { name: 'Margins', exact: true });
	await expect(margins).toHaveText('½ in');
	await pickNumber(fields, 'Margins', '⅝ in');
	await expect(margins).toHaveText('⅝ in');
	await fields.getByRole('combobox', { name: 'Margin unit' }).tap();
	await page.getByRole('option', { name: 'mm', exact: true }).tap();
	await expect(margins).toHaveText('16 mm');
	await pickNumber(fields, 'Margins', '15 mm');
	await expect(margins).toHaveText('15 mm');
});

// Trevor, 2026-10-29: the dotted "tap me" underline means nothing on paper; a switch keeps it.
test('rules terms print without their dotted underline unless switched on', async ({ page }) => {
	const { preview, fields } = await openSheet(page);
	const term = preview.locator('.front .glossary-term').first();
	await expect(term).toHaveCSS('text-decoration-line', 'none');
	await fields.getByText('Dotted underlines', { exact: true }).tap();
	await expect(term).toHaveCSS('text-decoration-line', 'underline');
});

// Trevor, 2026-10-22 (Ravenswood's info back), 2026-10-29: a switch per item on each side,
// so the jinxes, Fabled and Loric go on the front, the back or both.
test('the jinxes, Fabled and Loric go on either side, or both', async ({ page }) => {
	const shared = [{ id: '_meta', name: 'Info Back' }, 'chef', 'magician', 'spy', 'imp', 'djinn'];
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	await expect(page.getByRole('heading', { name: 'Info Back', level: 1 })).toBeVisible();
	const { preview, fields } = await openSheet(page);
	const front = preview.locator('.front');
	const back = preview.locator('.back');
	await expect(front.locator('[data-character="djinn"]')).toHaveCount(1);
	await expect(front.locator('.jinx')).toHaveCount(1);
	await expect(back.locator('[data-character="djinn"]')).toHaveCount(0);
	await expect(back.locator('.jinx')).toHaveCount(0);

	// The back's switches: Fabled and Loric, and Jinxes, are the second of each name.
	await fields.getByText('Fabled and Loric', { exact: true }).nth(1).tap();
	await fields.getByText('Jinxes', { exact: true }).nth(1).tap();
	await expect(back.locator('[data-character="djinn"]')).toHaveCount(1);
	await expect(back.locator('.jinx')).toHaveCount(1);
	// Both sides now; then the front's off.
	await expect(front.locator('[data-character="djinn"]')).toHaveCount(1);
	await fields.getByText('Fabled and Loric', { exact: true }).first().tap();
	await expect(front.locator('[data-character="djinn"]')).toHaveCount(0);
	await expect(front.locator('[data-character="spy"]')).toHaveCount(1);

	// No back: its rows stay, greyed out, and page 2 goes.
	await fields.getByText('Print a back', { exact: true }).tap();
	await expect(back).toHaveCount(0);
	await expect(
		fields.getByRole('checkbox', { name: 'Night order', exact: true, includeHidden: true })
	).toBeDisabled();
});

// Trevor, 2026-10-30: "also add download button, so they don't have to change save as pdf".
test('Download PDF saves both sides as a PDF named after the script', async ({ page }) => {
	// Picturing two pages at print sharpness takes a while on a busy machine.
	test.setTimeout(90_000);
	const { screen } = await openSheet(page);
	await expect(screen.getByTestId('print-laying-out')).toBeHidden();
	const [download] = await Promise.all([
		page.waitForEvent('download', { timeout: 60_000 }),
		screen.getByRole('button', { name: 'Download PDF' }).tap()
	]);
	expect(download.suggestedFilename()).toBe('trouble-brewing.pdf');
	const path = await download.path();
	const { readFile } = await import('node:fs/promises');
	const pdf = (await readFile(path)).toString('latin1');
	expect(pdf.startsWith('%PDF-')).toBe(true);
	// One page per side, on Letter paper by default.
	expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2);
	expect(pdf).toContain('/MediaBox [0 0 612 792]');
	// The file names its script and author in its properties.
	const utf16 = (text: string) =>
		'<FEFF' +
		[...text].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()).join('') +
		'>';
	expect(pdf).toContain(`/Title ${utf16('Trouble Brewing')}`);
	expect(pdf).toContain(`/Author ${utf16('The Pandemonium Institute')}`);
	// Its words lie invisibly over the picture, so they select and search (Trevor, 2026-10-30).
	expect(pdf).toContain('BT 3 Tr');
	expect(pdf).toContain('(Washerwoman)');
	// Saved, the Print screen closes.
	await expect(screen).toBeHidden();
});
