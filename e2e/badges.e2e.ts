import { expect, test } from '@playwright/test';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';

test('tapping a character badge shows its ability and a wiki link', async ({ page }) => {
	await page.goto('/spikes/badges');
	// CSS locator: the page behind an open dialog is aria-hidden, so role queries can't see it.
	// By the player's name: the dialog's live wiki page has Witch badges of its own.
	const badge = page.locator('button.badge', { hasText: /Witch.*Sam/ });
	await expect(badge).toContainText('Sam');
	await expect(badge.locator('img')).toBeVisible();
	// Measure only once the icon and fonts have loaded: a late font swap or image resizes the
	// badge, which made this check flaky under a loaded full-suite run.
	await expect
		.poll(() => badge.locator('img').evaluate((img: HTMLImageElement) => img.complete))
		.toBe(true);
	await page.evaluate(() => document.fonts.ready);
	const before = await badge.boundingBox();

	await badge.tap();
	const dialog = page.getByRole('dialog', { name: 'Witch' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Each night, choose a player');
	await expect(dialog.getByRole('link', { name: 'Open wiki' })).toHaveAttribute(
		'href',
		'https://wiki.bloodontheclocktower.com/Witch'
	);
	expect(await badge.boundingBox()).toEqual(before);
});

test('badges are coloured by team', async ({ page }) => {
	await page.goto('/spikes/badges');
	await expect(page.getByRole('button', { name: /Witch/ })).toHaveAttribute('data-team', 'evil');
	await expect(page.getByRole('button', { name: /Saint/ })).toHaveAttribute('data-team', 'good');
	await expect(page.getByRole('button', { name: /Beggar/ })).toHaveAttribute('data-team', 'evil');
});

test('a Traveller badge is half good, half evil until its alignment is set', async ({ page }) => {
	await page.goto('/reference');
	await page.getByRole('searchbox').fill('Beggar');
	const badge = page.locator('button.badge[data-character-id="beggar"]').first();
	await expect(badge).toHaveAttribute('data-team', 'traveller');
	await expect(badge).toHaveCSS('background-image', /linear-gradient/);
});

test('opening a character shows its whole wiki page, fetched live', async ({ page }) => {
	// A made-up page in the wiki's shape, so no wiki text is in the repo.
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) => {
		const title = new URL(route.request().url()).searchParams.get('page');
		route.fulfill({
			json: {
				parse: {
					text:
						'<div class="mw-parser-output"><div class="row"><div class="columns">' +
						'<div id="character-details"><p><span>Information</span></p>' +
						'<table><tr><td>Artist</td><td>Sample Artist</td></tr></table>' +
						'<p class="flavour">"Sample quote."</p><p><span>Appears in</span> <span>Sample episode</span></p></div>' +
						`</div><div class="columns"><h2>Summary</h2><p>Sample page for ${title}.</p>` +
						'<h2>How to Run</h2><ul><li>Sample step.</li></ul><div class="example"><p>Sample worked step.</p></div>' +
						'<h2>Examples</h2><div class="example"><p>Sample example one.</p></div>' +
						'<div class="example"><p>Sample example two.</p></div>' +
						'<h2>Tips &amp; Tricks</h2><ul><li>Sample tip one.</li></ul><ul><li>Sample tip two.</li></ul>' +
						'<h2>Bluffing as the Witch</h2><ul><li>Sample bluff.</li></ul>' +
						'<h2>Fighting the Witch</h2><ul><li>Sample fight.</li></ul>' +
						'<h2>Related Jinxes (Open)</h2><p>Sample wiki jinx.</p>' +
						`<h2>Long</h2>${'<p>Sample line.</p>'.repeat(80)}` +
						'</div></div></div>'
				}
			}
		});
	});
	await page.goto('/spikes/badges');
	await page.locator('button.badge', { hasText: 'Witch' }).first().tap();
	const dialog = page.getByRole('dialog', { name: 'Witch' });
	// Its reminder tokens, drawn as on the board, sit with the ability, above every section.
	const reminders = dialog.getByTestId('character-reminders');
	await expect(reminders.getByTestId('board-reminder')).toHaveText(['Cursed']);
	const wiki = dialog.getByTestId('wiki-page');
	await expect(wiki.getByRole('heading', { name: 'Summary' })).toBeVisible();
	// The name is a badge, whose own markup spacing shows up in the text.
	await expect(wiki).toContainText(/Sample page for\s+Witch\s*\./);
	// Only the Summary shows; the other sections are in a list beside or under it.
	await expect(dialog).not.toContainText('Sample step.');
	const sections = dialog.getByRole('navigation', { name: 'More from the wiki' });
	const wide = (await dialog.boundingBox())!.width >= 40 * 16;
	await expect(sections.getByRole('button', { name: 'Summary' })).toBeVisible({ visible: wide });

	await sections.getByRole('button', { name: 'How to Run' }).tap();
	const section = dialog.getByTestId('wiki-section');
	await expect(section.getByRole('heading', { name: 'How to Run' })).toBeVisible();
	await expect(section.getByRole('listitem')).toHaveText('Sample step.');
	// How to Run stays plain text, even where the wiki marks a worked step as an example.
	await expect(section).toContainText('Sample worked step.');
	await expect(section.getByRole('region')).toHaveCount(0);
	await expect(dialog.getByTestId('wiki-page')).toHaveCount(0);
	// Two panes on a tablet: the list stays; on a phone the section replaces it, with Back.
	await expect(sections).toBeVisible({ visible: wide });
	if (!wide) {
		await dialog.getByRole('button', { name: 'Summary' }).tap();
		await expect(dialog.getByTestId('wiki-page')).toBeVisible();
	}

	// Introduction: the quote in italics and the artist; no "Information" or "Appears in".
	await sections.getByRole('button', { name: 'Introduction' }).tap();
	await expect(section.locator('.quote')).toHaveText('"Sample quote."');
	await expect(section.locator('.quote')).toHaveCSS('font-style', 'italic');
	await expect(section).toContainText('Artist: Sample Artist');
	await expect(section).not.toContainText('Information');
	await expect(section).not.toContainText('Appears in');
	if (!wide) await dialog.getByRole('button', { name: 'Summary' }).tap();

	// Examples are numbered boxes; tips are boxes, not bullets.
	await sections.getByRole('button', { name: 'Examples' }).tap();
	await expect(section.getByRole('heading', { name: 'Example 1' })).toBeVisible();
	await expect(section.getByRole('heading', { name: 'Example 2' })).toBeVisible();
	if (!wide) await dialog.getByRole('button', { name: 'Summary' }).tap();
	await sections.getByRole('button', { name: 'Tips & Tricks' }).tap();
	await expect(section.getByRole('region', { name: 'Tip 2' })).toContainText('Sample tip two.');
	await expect(section.getByRole('listitem')).toHaveCount(0);
	// The character stays at the top of every section.
	await expect(dialog.locator('.character')).toContainText('Each night, choose a player');
	if (!wide) await dialog.getByRole('button', { name: 'Summary' }).tap();
	await sections.getByRole('button', { name: 'Bluffing as the Witch' }).tap();
	await expect(section.getByRole('region', { name: 'Bluffing tip 1' })).toContainText(
		'Sample bluff.'
	);
	// "Fighting the …" on Minions and Demons is boxed the same way (Trevor, 2026-10-18).
	if (!wide) await dialog.getByRole('button', { name: 'Summary' }).tap();
	await sections.getByRole('button', { name: 'Fighting the Witch' }).tap();
	await expect(section.getByRole('region', { name: 'Fighting tip 1' })).toContainText(
		'Sample fight.'
	);
	await expect(section.getByRole('listitem')).toHaveCount(0);

	// The wiki's jinx list is left out; Jinxes lists TPI's (the Witch has none).
	await expect(sections.getByRole('button', { name: /Related Jinxes/ })).toHaveCount(0);
	if (!wide) await dialog.getByRole('button', { name: 'Summary' }).tap();
	await sections.getByRole('button', { name: 'Jinxes' }).tap();
	await expect(dialog.getByTestId('jinx-section')).toContainText('None');
	// The top band names the type and where the character comes from.
	await expect(dialog.locator('.character .type')).toHaveText('Minion · Sects & Violets');
	await expect(reminders).toBeInViewport();

	// A long section scrolls inside the dialog, the character staying in view.
	if (!wide) await dialog.getByRole('button', { name: 'Summary' }).tap();
	await sections.getByRole('button', { name: 'Long' }).tap();
	const last = section.getByText('Sample line.').last();
	await last.scrollIntoViewIfNeeded();
	await expect(last).toBeInViewport();
	await expect(dialog.locator('.character')).toBeInViewport();
});

test('the Jinxes section lists every TPI jinx under the other character', async ({ page }) => {
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({ json: { parse: { text: '<h2>Summary</h2><p>Sample.</p>' } } })
	);
	await page.goto('/reference');
	await page.getByRole('searchbox').fill('Alchemist');
	await page.getByRole('button', { name: 'About the Alchemist' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Alchemist' });
	const sections = dialog.getByRole('navigation', { name: 'More from the wiki' });
	await sections.getByRole('button', { name: 'Jinxes' }).tap();
	const jinxes = dialog.getByTestId('jinx-section');
	// Each jinx is headed by the other character's text-size badge, across the section, with
	// the jinx indented under it (Trevor, 2026-10-16).
	const bar = jinxes.locator('.entry .bar').first().locator('.badge');
	await expect(bar).toHaveAttribute('data-character-id', 'boffin');
	const barBox = (await bar.boundingBox())!;
	const sectionBox = (await jinxes.locator('.entry').first().boundingBox())!;
	expect(barBox.width).toBeGreaterThan(sectionBox.width - 2);
	await expect(jinxes.locator('.entry .body').first()).not.toHaveCSS('padding-inline-start', '0px');
});

test("a character's own badge inside its details brings them back into view", async ({ page }) => {
	// Tapping it opened a second copy over the first: a flash, and one more close (Trevor,
	// 2026-10-19). It stays tappable and highlights the details instead (Trevor, 2026-10-20).
	// Other characters' badges there still open theirs.
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({
			json: { parse: { text: '<h2>Summary</h2><p>The Alchemist is not the Boffin.</p>' } }
		})
	);
	await page.goto('/reference');
	await page.getByRole('searchbox').fill('Alchemist');
	await page.getByRole('button', { name: 'About the Alchemist' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Alchemist' });
	await expect(dialog).toContainText('is not the');
	const own = dialog.locator('p .badge[data-character-id="alchemist"]').first();
	await expect(own).toBeVisible();
	await expect(own).toHaveRole('button');
	await expect(own).not.toHaveAttribute('aria-haspopup');
	await expect(own).toHaveCSS('cursor', 'pointer');
	const summary = dialog.getByTestId('own-summary');
	await expect(summary).not.toHaveAttribute('data-pulse');
	await own.tap();
	await expect(summary).toHaveAttribute('data-pulse', '');
	// Drawn inside the box, so the dialog's edges can't clip it (Trevor, 2026-10-24).
	await expect(summary).toHaveCSS('box-shadow', /inset/);
	await expect(page.getByRole('dialog', { name: 'Alchemist' })).toHaveCount(1);
	await expect(dialog.locator('p .badge[data-character-id="boffin"]').first()).toHaveAttribute(
		'aria-haspopup',
		'dialog'
	);
});

test('the sections list counts tips, examples and jinxes, with lines between', async ({ page }) => {
	// Trevor, 2026-10-20: a count per section, and lines between the list and the text and
	// between entries, on a computer as on a phone.
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({
			json: {
				parse: {
					text:
						'<h2>Summary</h2><p>Sample.</p><h2>How to Run</h2><p>Sample step.</p>' +
						'<h2>Examples</h2><div class="example"><p>One.</p></div>' +
						'<div class="example"><p>Two.</p></div>' +
						'<h2>Tips &amp; Tricks</h2><ul><li>One.</li><li>Two.</li></ul><ul><li>Three.</li></ul>'
				}
			}
		})
	);
	await page.goto('/reference');
	await page.getByRole('searchbox').fill('Alchemist');
	await page.getByRole('button', { name: 'About the Alchemist' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Alchemist' });
	const sections = dialog.getByRole('navigation', { name: 'More from the wiki' });
	const count = (name: string) =>
		sections.getByRole('button', { name }).getByTestId('contents-count');
	await expect(count('Examples')).toHaveText('2');
	await expect(count('Tips & Tricks')).toHaveText('3');
	// As many as the Jinxes section lists.
	const jinxes = Number(await count('Jinxes').textContent());
	expect(jinxes).toBeGreaterThan(0);
	// Plain text has nothing to count.
	await expect(count('How to Run')).toHaveCount(0);
	// A line under every entry; beside the text when the list sits on its left.
	const entry = sections.getByRole('button', { name: 'Examples' });
	await expect(entry).not.toHaveCSS('border-bottom-width', '0px');
	const wide = (await dialog.boundingBox())!.width >= 40 * 16;
	if (wide) {
		await expect(sections).not.toHaveCSS('border-right-width', '0px');
		// The side line meets the line under the character, with no line of the list's own
		// above the first entry (Trevor, 2026-10-24).
		await expect(sections.locator('ul')).toHaveCSS('border-top-width', '0px');
		const top = (await sections.boundingBox())!.y;
		const summary = (await dialog.getByTestId('own-summary').boundingBox())!;
		expect(Math.abs(top - (summary.y + summary.height))).toBeLessThan(2);
	}

	// The wiki link is an icon button, like the X beside it.
	const wiki = dialog.getByRole('link', { name: 'Open wiki' });
	await expect(wiki).toHaveClass(/icon-button/);
	await expect(wiki).toHaveAttribute('target', '_blank');
	await expect(wiki).toHaveAttribute('rel', 'noopener');
	const close = dialog.getByRole('button', { name: 'Close' });
	expect((await wiki.boundingBox())!.height).toBeCloseTo((await close.boundingBox())!.height, 0);

	await sections.getByRole('button', { name: 'Jinxes' }).tap();
	await expect(dialog.getByTestId('jinx-section').locator('.entry')).toHaveCount(jinxes);
});

test("a character's type and source open every character of that group", async ({ page }) => {
	// Trevor, 2026-10-20: a page of all the characters of one source script or the Carousel
	// and one character type.
	await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
		route.fulfill({ json: { parse: { text: '<h2>Summary</h2><p>Sample.</p>' } } })
	);
	await page.goto('/reference');
	await page.getByRole('searchbox').fill('Witch');
	await page.getByRole('button', { name: 'About the Witch' }).tap();
	const witch = page.getByRole('dialog', { name: 'Witch' });
	const line = witch.getByRole('button', { name: 'Minion · Sects & Violets' });
	await expect(line).toHaveAttribute('title', 'Every Minion from Sects & Violets');
	await line.tap();

	await expect(page.getByRole('dialog', { name: 'Sects & Violets Minions' })).toBeVisible();
	// The title follows the choices below.
	const group = page.getByRole('dialog').filter({ has: page.getByTestId('character-group') });
	const entries = group.getByTestId('character-group').locator('.entry');
	await expect(entries).toHaveCount(4);
	await expect(entries.locator('.badge[data-character-id="witch"]')).toHaveCount(1);
	// Each with its ability.
	await expect(
		entries.locator('.badge[data-character-id="witch"]').locator('xpath=../..')
	).toContainText('if they nominate tomorrow');

	// The type and source can be changed here.
	await group.getByRole('combobox', { name: 'Character type' }).tap();
	await page.getByRole('option', { name: 'Demon', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Sects & Violets Demons' })).toBeVisible();
	await expect(entries).toHaveCount(4);
	await group.getByRole('combobox', { name: 'Source' }).tap();
	await page.getByRole('option', { name: 'Trouble Brewing', exact: true }).tap();
	await expect(entries.locator('.bar .badge')).toHaveAttribute('data-character-id', 'imp');

	// A character there opens its own details, over the list.
	await entries.locator('.bar .badge').tap();
	await expect(page.getByRole('dialog', { name: 'Imp' })).toBeVisible();
});

test('a badge on its own line keeps the in-line height, with a 44px tap area', async ({ page }) => {
	// One design everywhere (Trevor, 2026-10-20): the script sheet's normal density once drew a
	// tall pill. The base button rule's 44px minimum must not stretch the badge either. A jinx's
	// pair is the sheet's badges on their own line (its characters are rings, 2026-10-28).
	const shared = [{ id: '_meta', name: 'Jinx Night' }, 'alchemist', 'marionette', 'imp'];
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	// TPI jinx: Alchemist and Marionette (wiki: Djinn's Jinxes list).
	const badge = page.locator('.jinx .badge[data-character-id="alchemist"]').first();
	await expect(badge).toBeVisible();
	const sizes = await badge.evaluate((el) => {
		const fontSize = parseFloat(getComputedStyle(el).fontSize);
		const tap = parseFloat(getComputedStyle(el, '::before').height);
		return { height: el.getBoundingClientRect().height, fontSize, tap };
	});
	expect(sizes.height).toBeLessThan(sizes.fontSize * 1.5);
	// The tap area is calc()ed from the badge height, so it can land a hair under 44px.
	expect(sizes.tap).toBeGreaterThan(43.5);
});
