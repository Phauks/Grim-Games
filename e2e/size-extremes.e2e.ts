import { expect, test, type Locator, type Page } from '@playwright/test';

// Trevor (2026-10-16): the character details and Glossary dialogs must fit at every text,
// icon, token and reminder size. Smallest and largest of each, on the phone and tablet.

const SIZES = [
	{ name: 'smallest', textScale: 0.75, iconScale: 0.75, scale: 0.5 },
	{ name: 'largest', textScale: 1.5, iconScale: 1.5, scale: 2 }
];

async function setSizes(page: Page, size: (typeof SIZES)[number]) {
	await page.addInitScript((size) => {
		localStorage.setItem(
			'grim-games:preferences:v1',
			JSON.stringify({
				textScale: size.textScale,
				iconScale: size.iconScale,
				characterIconScale: size.iconScale,
				tokenAppearance: { tokenScale: size.scale, reminderScale: size.scale, boardNames: true }
			})
		);
	}, size);
	// Made-up pages in the wiki's shapes; no wiki text is in the repo.
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) => {
		const page = new URL(route.request().url()).searchParams.get('page');
		route.fulfill({
			json: {
				parse: {
					text:
						page === 'Glossary'
							? '<p><b>Poisoned:</b> Sample wording for poisoned.</p><p><b>Alive:</b> Sample.</p>'
							: '<div class="mw-parser-output"><h2>Summary</h2><p>Sample summary.</p>' +
								'<h2>How to Run</h2><p>Sample.</p></div>'
				}
			}
		});
	});
}

/** Nothing in the dialog pokes out of it sideways, and its header is on screen. */
async function expectFits(dialog: Locator) {
	// A section slides in over a moment on phones; measure where it comes to rest.
	await dialog.evaluate((el) =>
		Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
	);
	const result = await dialog.evaluate((el) => {
		const box = el.getBoundingClientRect();
		const offenders = [...el.querySelectorAll('*')]
			.filter((child) => {
				const r = child.getBoundingClientRect();
				return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1);
			})
			.slice(0, 5)
			.map((child) => {
				const r = child.getBoundingClientRect();
				return `${child.tagName.toLowerCase()}.${String(child.className).split(' ')[0]} ${Math.round(r.left)}-${Math.round(r.right)} in ${Math.round(box.left)}-${Math.round(box.right)}`;
			});
		return {
			offenders,
			wider: el.scrollWidth > el.clientWidth + 1,
			onScreen: box.top >= 0 && box.left >= 0 && box.right <= window.innerWidth + 1
		};
	});
	expect(result.offenders, result.offenders.join(', ')).toEqual([]);
	expect(result.wider).toBe(false);
	expect(result.onScreen).toBe(true);
	await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport();
}

for (const size of SIZES) {
	test(`character details fit at the ${size.name} sizes`, async ({ page }) => {
		await setSizes(page, size);
		await page.goto('/spikes/badges');
		await page.locator('button.badge', { hasText: 'Witch' }).first().tap();
		const dialog = page.getByRole('dialog', { name: 'Witch' });
		await expect(dialog.getByTestId('wiki-page')).toContainText('Sample summary.');
		await expect(dialog.locator('.character .icon img')).toBeInViewport();
		await expectFits(dialog);
		await dialog.getByRole('button', { name: 'Jinxes' }).tap();
		await expect(dialog.getByTestId('jinx-section')).toBeVisible();
		await expectFits(dialog);
	});

	test(`the Glossary fits at the ${size.name} sizes`, async ({ page }) => {
		await setSizes(page, size);
		await page.goto('/reference');
		await page.getByRole('searchbox', { name: 'Search characters' }).fill('Poisoner');
		await page
			.getByTestId('character-table')
			.locator('tr[data-character="poisoner"]')
			.getByRole('button', { name: 'poisoned: explain rules term' })
			.tap();
		await page
			.getByRole('dialog', { name: 'Poisoned' })
			.getByRole('button', { name: 'Open Glossary' })
			.tap();
		const dialog = page.getByRole('dialog', { name: 'Glossary' });
		await expect(dialog.getByTestId('wiki-definition')).toHaveText('Sample wording for poisoned.');
		await expectFits(dialog);
	});
}

test('a rules term’s tap area never reaches past the word sideways', async ({ page }) => {
	// A wider hit area widened the line when a term ended it at the right edge, so the page
	// scrolled sideways on some phones (2026-10-16).
	await page.goto('/reference');
	const terms = page.locator('.glossary-term');
	await expect(terms.first()).toBeVisible();
	const wide = await terms.evaluateAll(
		(els) =>
			els
				.map((el) => getComputedStyle(el, '::after'))
				.filter((after) => after.left !== '0px' || after.right !== '0px').length
	);
	expect(wide).toBe(0);
});
