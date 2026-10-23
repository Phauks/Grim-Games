import { expect, test, type Page } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

/** The Poisoner's row in the Character reference table. */
async function poisonerCard(page: Page) {
	await page.goto('/reference');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Poisoner');
	const card = page.getByTestId('character-table').locator('tr[data-character="poisoner"]');
	await expect(card).toBeVisible();
	return card;
}

/** The wiki API, answered with a made-up page so no wiki text is in the repo. */
async function mockWiki(page: Page) {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({
			json: { parse: { text: '<p><b>Poisoned:</b> Sample wiki wording for poisoned.</p>' } }
		})
	);
}

test('tapping a rules term shows the wiki Glossary wording and button, without moving the page', async ({
	page
}) => {
	await mockWiki(page);
	const card = await poisonerCard(page);
	const term = card.getByRole('button', { name: 'poisoned: explain rules term' });
	await expect(term).toBeVisible();
	// A dotted underline, so it is not mistaken for a link.
	expect(await term.evaluate((el) => getComputedStyle(el).textDecorationStyle)).toBe('dotted');

	// Tap just below the word: the hit area is a full tap target, not only the letters. (Above
	// it, a row's first line sits under the table's sticky header.)
	// Clear of the table's pinned columns, which scroll over a term at their edge.
	await term.scrollIntoViewIfNeeded();
	await term.evaluate((el) => {
		const scroller = el.closest('[role="region"]')!;
		const pinned = scroller.querySelector('th[data-col="name"]')!.getBoundingClientRect();
		scroller.scrollLeft += el.getBoundingClientRect().left - pinned.right - 40;
	});
	const box = (await term.boundingBox())!;
	// The word sits in the line like plain text: no taller than the line around it.
	expect(box.height).toBeLessThan(32);
	const before = await card.boundingBox();
	await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height + 8);

	const popover = page.getByRole('dialog', { name: 'Poisoned' });
	await expect(popover).toBeVisible();
	// The wiki's own wording, fetched live (mocked here with made-up text).
	await expect(popover.getByTestId('wiki-definition')).toHaveText(
		'Sample wiki wording for poisoned.'
	);
	// The entry's own word is not marked: it would only open itself (Trevor, 2026-10-16).
	await expect(popover.locator('.glossary-term')).toHaveCount(0);
	await expect(popover.getByRole('button', { name: 'Open Glossary' })).toBeVisible();
	// An overlay: the card did not reflow.
	expect(await card.boundingBox()).toEqual(before);

	await popover.getByRole('button', { name: 'Close' }).tap();
	await expect(popover).toBeHidden();
});

test('with rules term underlines off the terms are plain text', async ({ page }) => {
	await page.goto('/reference');
	await openSettingsDialog(page);
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Text', exact: true })
		.tap();
	const label = 'Underline rules terms with glossary definitions';
	const explain = settings.getByRole('checkbox', { name: label, includeHidden: true });
	await expect(explain).toBeChecked();
	await settings.getByText(label, { exact: true }).tap();
	await expect(explain).not.toBeChecked();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();

	const card = await poisonerCard(page);
	await expect(card).toContainText('they are poisoned tonight');
	await expect(card.locator('.glossary-term')).toHaveCount(0);
});

test('terms in the character dialog open above it', async ({ page }) => {
	await page.goto('/spikes/day');
	await page.getByRole('combobox', { name: 'Sample game' }).tap();
	await page.getByRole('option', { name: 'Trouble Brewing', exact: true }).tap();
	await page
		.locator('li[data-character="slayer"]')
		.getByRole('button', { name: 'About the Slayer' })
		.first()
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Slayer' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'once per game: explain rules term' }).tap();
	const popover = page.getByRole('dialog', { name: 'Once per game' });
	await expect(popover).toBeVisible();
	await expect(popover.getByRole('button', { name: 'Open Glossary' })).toBeVisible();
	// Still usable above the modal dialog: closing it leaves the dialog open.
	await popover.getByRole('button', { name: 'Close' }).tap();
	await expect(popover).toBeHidden();
	await expect(dialog).toBeVisible();
});

test('without the wiki the popover shows only the term and the Glossary button', async ({
	page
}) => {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) => route.abort());
	const card = await poisonerCard(page);
	await card.getByRole('button', { name: 'poisoned: explain rules term' }).tap();
	const popover = page.getByRole('dialog', { name: 'Poisoned' });
	await expect(popover.getByRole('button', { name: 'Open Glossary' })).toBeVisible();
	await expect(popover.getByTestId('wiki-definition')).toHaveCount(0);
});

test('a "see …" link in the wiki wording opens that entry, with Back, and characters are badges', async ({
	page
}) => {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({
			json: {
				parse: {
					text:
						'<p><b>Poisoned:</b> Sample wording, see <a href="/Glossary#Healthy">Healthy</a>' +
						' and the <a href="/Poisoner">Poisoner</a>.</p>' +
						'<p><b>Healthy:</b> Sample wording for healthy.</p>'
				}
			}
		})
	);
	const card = await poisonerCard(page);
	await card.getByRole('button', { name: 'poisoned: explain rules term' }).tap();
	const popover = page.getByRole('dialog', { name: 'Poisoned' });
	const definition = popover.getByTestId('wiki-definition');
	await expect(definition).toHaveText(/^Sample wording, see Healthy and the\s+Poisoner\s*\.$/);
	await expect(definition.locator('[data-character-id="poisoner"]')).toBeVisible();

	await definition.getByRole('button', { name: 'Healthy' }).tap();
	const healthy = page.getByRole('dialog', { name: 'Healthy' });
	await expect(healthy.getByTestId('wiki-definition')).toHaveText('Sample wording for healthy.');
	await healthy.getByRole('button', { name: 'Back to Poisoned' }).tap();
	await expect(page.getByRole('dialog', { name: 'Poisoned' })).toBeVisible();

	// The character in the definition opens its details with its icon and the wiki button.
	await page
		.getByRole('dialog', { name: 'Poisoned' })
		.locator('[data-character-id="poisoner"]')
		.tap();
	const details = page.getByRole('dialog', { name: 'Poisoner', exact: true });
	const icon = details.locator('.character .icon img');
	await expect(icon).toBeVisible();
	await expect(icon).toHaveAttribute('src', /poisoner_e\.webp$/);
	// The image may still be loading when it first shows: wait for it to decode.
	await expect
		.poll(() => icon.evaluate((img: HTMLImageElement) => img.naturalWidth))
		.toBeGreaterThan(0);
	await expect(details.getByRole('link', { name: 'Open wiki' })).toBeVisible();
});

test('Open Glossary shows every entry beside the tapped one, searchable, with the wiki link', async ({
	page
}, testInfo) => {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({
			json: {
				parse: {
					text:
						'<p><b>Poisoned:</b> Sample wording, see <a href="/Glossary#Healthy">Healthy</a>.</p>' +
						'<p><b>Healthy:</b> Sample wording for healthy.</p>' +
						'<p><b>Alive:</b> Sample wording for alive, unlike a dead player.</p>' +
						'<p><b>Dead:</b> Sample wording for dead.</p>'
				}
			}
		})
	);
	const card = await poisonerCard(page);
	await card.getByRole('button', { name: 'poisoned: explain rules term' }).tap();
	await page
		.getByRole('dialog', { name: 'Poisoned' })
		.getByRole('button', { name: 'Open Glossary' })
		.tap();
	const glossary = page.getByRole('dialog', { name: 'Glossary' });
	const entry = glossary.getByTestId('glossary-entry');
	// Opens on the entry that was tapped, in the wiki's own (here made-up) wording.
	await expect(entry.getByRole('heading', { name: 'Poisoned' })).toBeVisible();
	await expect(entry.getByTestId('wiki-definition')).toHaveText('Sample wording, see Healthy.');
	// The wiki button opens the Glossary page at this entry, in a new tab.
	const wiki = glossary.getByRole('link', { name: 'Open the Glossary on the wiki' });
	await expect(wiki).toHaveAttribute(
		'href',
		/^https:\/\/wiki\.bloodontheclocktower\.com\/Glossary#/
	);
	await expect(wiki).toHaveAttribute('target', '_blank');

	// A "see …" link opens that entry's popup over the dialog, which stays on its entry.
	await entry.getByRole('button', { name: 'Healthy' }).tap();
	const healthy = page.getByRole('dialog', { name: 'Healthy' });
	await expect(healthy.getByTestId('wiki-definition')).toHaveText('Sample wording for healthy.');
	await expect(entry.getByRole('heading', { name: 'Poisoned' })).toBeVisible();
	await healthy.getByRole('button', { name: 'Close' }).tap();
	await expect(healthy).toBeHidden();

	const phone = testInfo.project.name === 'phone';
	const list = glossary.getByRole('navigation', { name: 'Glossary entries' });
	// The entries, not the search field's Clear.
	const entries = list.getByRole('button', { name: /^(?!Clear$)/ });
	if (phone) {
		// On a phone the entry covers the list; Back shows the list.
		await expect(list).toBeHidden();
		await glossary.getByRole('button', { name: 'Glossary', exact: true }).tap();
	}
	await expect(list).toBeVisible();
	// Every entry, alphabetical.
	await expect(entries).toHaveText(['Alive', 'Dead', 'Healthy', 'Poisoned']);
	await list.getByRole('searchbox', { name: 'Search the Glossary' }).fill('ali');
	await expect(entries).toHaveText(['Alive']);
	await list.getByRole('button', { name: 'Alive' }).tap();
	await expect(entry.getByTestId('wiki-definition')).toHaveText(
		'Sample wording for alive, unlike a dead player.'
	);
	if (phone) await expect(list).toBeHidden();
	else
		await expect(list.getByRole('button', { name: 'Alive' })).toHaveAttribute(
			'aria-current',
			'page'
		);

	// Rules terms in an entry are marked as anywhere else, except the entry's own, and open
	// their popup over it.
	await expect(entry.getByRole('button', { name: 'alive: explain rules term' })).toHaveCount(0);
	await entry.getByRole('button', { name: 'dead: explain rules term' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Dead' }).getByTestId('wiki-definition')
	).toHaveText('Sample wording for dead.');
	await expect(entry.getByRole('heading', { name: 'Alive' })).toBeVisible();
});

test('the Glossary keeps its text and boxes clear of the scrollbar', async ({ page }, testInfo) => {
	// Enough entries that the list scrolls, each with wording long enough to wrap.
	const names = Array.from({ length: 40 }, (_, i) => `Term ${String(i).padStart(2, '0')}`);
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({
			json: {
				parse: {
					text: [
						'<p><b>Poisoned:</b> ' + 'Sample wording that wraps across lines. '.repeat(40) + '</p>',
						...names.map((name) => `<p><b>${name}:</b> Sample wording.</p>`)
					].join('')
				}
			}
		})
	);
	const card = await poisonerCard(page);
	await card.getByRole('button', { name: 'poisoned: explain rules term' }).tap();
	await page
		.getByRole('dialog', { name: 'Poisoned' })
		.getByRole('button', { name: 'Open Glossary' })
		.tap();
	const glossary = page.getByRole('dialog', { name: 'Glossary' });
	const entry = glossary.getByTestId('glossary-entry');
	await expect(entry.getByRole('heading', { name: 'Poisoned' })).toBeVisible();

	/** Space between the element's right edge and the inside right edge of what scrolls it. */
	const room = (selector: string) =>
		glossary
			.locator(selector)
			.first()
			.evaluate((el) => {
				let scroller = el.parentElement!;
				while (!['auto', 'scroll'].includes(getComputedStyle(scroller).overflowY))
					scroller = scroller.parentElement!;
				const box = scroller.getBoundingClientRect();
				// clientWidth leaves out a scrollbar that takes room; a phone's is drawn over the content.
				return (
					box.left + scroller.clientLeft + scroller.clientWidth - el.getBoundingClientRect().right
				);
			});
	// The entry's text (a scrollbar on a phone is drawn about this wide over the content).
	expect(await room('[data-testid="wiki-definition"]')).toBeGreaterThanOrEqual(6);

	if (testInfo.project.name === 'phone')
		await glossary.getByRole('button', { name: 'Glossary', exact: true }).tap();
	const list = glossary.getByRole('navigation', { name: 'Glossary entries' });
	await expect(list).toBeVisible();
	// The search box and the entries' boxes.
	expect(await room('nav input')).toBeGreaterThanOrEqual(6);
	expect(await room('nav li button')).toBeGreaterThanOrEqual(6);
});

test('the Glossary links the current script’s almanac when it has one', async ({ page }) => {
	// Trevor, backlog P1: an almanac link in the Glossary, from the script's own `_meta`.
	await mockWiki(page);
	const openGlossary = async () => {
		const card = await poisonerCard(page);
		await card.getByRole('button', { name: 'poisoned: explain rules term' }).tap();
		await page
			.getByRole('dialog', { name: 'Poisoned' })
			.getByRole('button', { name: 'Open Glossary' })
			.tap();
		return page.getByRole('dialog', { name: 'Glossary' });
	};
	// Without one, the button is there but unusable, so the header never moves.
	let glossary = await openGlossary();
	await expect(glossary.getByRole('button', { name: 'Open the script’s almanac' })).toBeDisabled();

	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'almanac.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([
				{ id: '_meta', name: 'Almanac Test', almanac: 'https://example.com/almanac-test' },
				'washerwoman',
				'imp'
			])
		)
	});
	await expect(
		page
			.getByRole('dialog', { name: 'Almanac Test' })
			.or(page.getByRole('region', { name: 'Almanac Test' }))
	).toBeVisible();
	glossary = await openGlossary();
	await expect(glossary.getByRole('link', { name: 'Open the script’s almanac' })).toHaveAttribute(
		'href',
		'https://example.com/almanac-test'
	);
});
