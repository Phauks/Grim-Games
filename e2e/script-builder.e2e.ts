import { expect, test, type Page } from '@playwright/test';

// The Script builder in Prepare (Trevor, 2026-10-16): pick official characters, see the
// script check (jinxed pairs, no Djinn line: Trevor 2026-10-17), save into the saved scripts New game uses.

function character(page: Page, name: string) {
	return page.getByTestId('character-picker').getByRole('button', { name, exact: true });
}

test('builds, checks and saves a script that New game can use', async ({ page }) => {
	await page.goto('/build-script');
	await expect(page.getByRole('heading', { name: 'Script builder', level: 1 })).toBeVisible();
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeDisabled();

	await page.getByRole('textbox', { name: 'Name' }).fill('Builder test');
	await page.getByRole('textbox', { name: 'Author' }).fill('Trevor');
	for (const name of ['Chef', 'Spy', 'Magician', 'Imp']) await character(page, name).tap();
	await expect(character(page, 'Chef')).toHaveAttribute('aria-pressed', 'true');
	// The Magician is a Townsfolk, the Spy a Minion.
	await expect(page.getByTestId('count-townsfolk')).toHaveText('2');
	await expect(page.getByTestId('count-minion')).toHaveText('1');
	await expect(page.getByTestId('count-demon')).toHaveText('1');

	// Spy and Magician are jinxed: the check lists the pair.
	const check = page.getByTestId('builder-check');
	await expect(check.getByTestId('jinx-count')).toHaveText('1');

	await save.tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

	// The draft stays on the device, and the saved script is offered when starting a game.
	await page.reload();
	await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Builder test');
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
	await page.goto('/new');
	await expect(
		page.getByRole('radiogroup', { name: 'Script' }).getByText('Builder test')
	).toBeVisible();
});

test('offers the character another needs, and clearing confirms', async ({ page }) => {
	await page.goto('/build-script');
	await character(page, 'Choirboy').tap();
	const check = page.getByTestId('builder-check');
	await check.getByRole('button', { name: 'Add', exact: true }).tap();
	await expect(character(page, 'King')).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('button', { name: 'Clear the script' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Clear the script?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await expect(page.getByRole('button', { name: 'Clear the script' })).toBeDisabled();
});

test('opens a saved script to edit it', async ({ page }) => {
	await page.goto('/build-script');
	await page.getByRole('textbox', { name: 'Name' }).fill('Reopen me');
	for (const name of ['Chef', 'Imp']) await character(page, name).tap();
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Clear the script' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Clear the script?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByTestId('count-demon')).toHaveText('0');

	await page.getByRole('button', { name: 'Open a saved script' }).tap();
	await page.getByRole('dialog', { name: 'Open a saved script' }).getByText('Reopen me').tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
	await expect(page.getByTestId('count-demon')).toHaveText('1');
	await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Reopen me');
	// Still the same saved script, so nothing new to save.
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

	// Another page (the Library) can open it here by its id in the address hash.
	const id = await page.evaluate(
		() => JSON.parse(localStorage.getItem('grim-games:script-builder') ?? '{}').editing as string
	);
	await page.getByRole('button', { name: 'Clear the script' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Clear the script?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await page.goto(`/build-script#edit=${id}`);
	await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Reopen me');
	await expect(page).toHaveURL(/\/build-script$/);
});

test('adds a homebrew character from a Homebrew Wiki collection, credited', async ({ page }) => {
	// The Worker fetches the wiki; here its answers are stood in for, so the test needs no network.
	await page.route('**/api/homebrew-wiki/collections', (route) =>
		route.fulfill({ json: [{ id: 'temple-fair', name: 'Temple Fair' }] })
	);
	await page.route('**/api/homebrew-wiki/collections/temple-fair', (route) =>
		route.fulfill({
			json: {
				script: [
					{ id: '_meta', name: 'Temple Fair' },
					{
						id: 'lantern',
						name: 'Lantern',
						team: 'outsider',
						ability: 'You start knowing 1 good player.'
					}
				],
				credits: [{ name: 'Lantern', creator: 'DJ', url: 'https://botchomebrew.wiki/c/lantern' }]
			}
		})
	);
	// Homebrew chosen before the official characters arrive still lists the collection.
	await page.route('**/data/roles.json', async (route) => {
		await new Promise((done) => setTimeout(done, 1500));
		await route.continue();
	});
	await page.goto('/build-script');
	await page.getByRole('combobox', { name: 'Characters from' }).tap();
	await page.getByRole('option', { name: 'Homebrew Wiki', exact: true }).tap();
	await expect(page.getByTestId('builder-collection')).toHaveText('Temple Fair');
	await character(page, 'Lantern, By DJ').tap();
	await expect(page.getByTestId('count-outsider')).toHaveText('1');
	await expect(page.getByTestId('homebrew-count')).toHaveText('1');
	const check = page.getByTestId('builder-check');
	await expect(check.getByText('DJ', { exact: true })).toBeVisible();
	await expect(check.getByRole('link', { name: 'Lantern on the Homebrew Wiki' })).toHaveAttribute(
		'href',
		'https://botchomebrew.wiki/c/lantern'
	);

	// Back to official characters: the homebrew one stays on the script.
	await page.getByRole('combobox', { name: 'Characters from' }).tap();
	await page.getByRole('option', { name: 'Official', exact: true }).tap();
	await character(page, 'Imp').tap();
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
	await expect(page.getByTestId('count-outsider')).toHaveText('1');
});

// Trevor (2026-10-17): characters from several collections are hard to reach while they
// only show under their own collection, so the chosen ones are listed together. This was the
// "On script" source; on 2026-10-18 it became Show only selected, a state and not a source.
// The collections are a search with a list (Trevor, 2026-10-18), not a drop-down.
test('Show only selected lists the chosen characters from every source together', async ({
	page
}) => {
	const collection = (id: string, name: string, character: string, creator: string) => ({
		script: [
			{ id: '_meta', name },
			{ id, name: character, team: 'townsfolk', ability: 'You start knowing 1 good player.' }
		],
		credits: [{ name: character, creator, url: `https://botchomebrew.wiki/c/${id}` }]
	});
	await page.route('**/api/homebrew-wiki/collections', (route) =>
		route.fulfill({
			json: [
				{ id: 'temple-fair', name: 'Temple Fair' },
				{ id: 'night-market', name: 'Night Market' }
			]
		})
	);
	await page.route('**/api/homebrew-wiki/collections/temple-fair', (route) =>
		route.fulfill({ json: collection('lantern', 'Temple Fair', 'Lantern', 'DJ') })
	);
	await page.route('**/api/homebrew-wiki/collections/night-market', (route) =>
		route.fulfill({ json: collection('peddler', 'Night Market', 'Peddler', 'Ana') })
	);
	await page.goto('/build-script');
	await character(page, 'Chef').tap();
	await page.getByRole('combobox', { name: 'Characters from' }).tap();
	await page.getByRole('option', { name: 'Homebrew Wiki', exact: true }).tap();
	const picked = page.getByTestId('builder-collection');
	await expect(picked).toHaveText('Temple Fair');
	await character(page, 'Lantern, By DJ').tap();
	await picked.tap();
	const collections = page.getByRole('dialog', { name: 'Homebrew Wiki collection' });
	await collections.getByRole('searchbox', { name: 'Search collections' }).fill('night');
	await expect(collections.getByRole('button', { name: 'Temple Fair' })).toHaveCount(0);
	await collections.getByRole('button', { name: 'Night Market' }).tap();
	await expect(picked).toHaveText('Night Market');
	await character(page, 'Peddler, By Ana').tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('3');

	await page.getByRole('button', { name: 'Show only selected' }).tap();
	// The page still fits a phone without scrolling sideways.
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	const list = page.getByTestId('character-picker');
	await expect(list.getByRole('button', { pressed: true })).toHaveCount(3);
	await expect(character(page, 'Lantern, By DJ')).toBeVisible();
	await expect(character(page, 'Peddler, By Ana')).toBeVisible();
	await expect(character(page, 'Chef')).toBeVisible();
	await expect(list.getByRole('button', { name: 'Imp' })).toHaveCount(0);

	// Tapping one there takes it off the script.
	await character(page, 'Lantern, By DJ').tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('2');
	await expect(list.getByRole('button', { name: 'Lantern, By DJ' })).toHaveCount(0);
});

// Trevor (2026-10-17): "Need better ability to edit a script created in the builder".
test('editing a built script keeps its Library folder, and Save as new keeps the original', async ({
	page
}) => {
	const libraryRows = () =>
		page.getByTestId('library-table').getByRole('button', { name: /^Edited here/ });
	const search = () =>
		page.getByRole('searchbox', { name: 'Search the Library' }).fill('Edited here');
	await page.goto('/build-script');
	await page.getByRole('textbox', { name: 'Name' }).fill('Edited here');
	for (const name of ['Chef', 'Imp']) await character(page, name).tap();
	const saveNew = page.getByRole('button', { name: 'Save as new' });
	// Nothing saved yet, so there is nothing to copy.
	await expect(saveNew).toBeDisabled();
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

	// File it in a folder in the Library.
	await page.goto('/library');
	await page.getByRole('button', { name: 'New folder' }).tap();
	const folder = page.getByRole('dialog', { name: 'New folder' });
	await folder.getByRole('textbox', { name: 'Name' }).fill('Club night');
	await folder.getByRole('textbox', { name: 'Name' }).press('Enter');
	await libraryRows().tap();
	const details = page.getByRole('dialog', { name: 'Edited here' });
	await details.getByRole('combobox', { name: 'Folder' }).tap();
	await page.getByRole('option', { name: 'Club night' }).tap();

	// Edit it: the change replaces the script, and the folder stays with it.
	await details.getByRole('button', { name: 'Edit in Script builder' }).tap();
	await expect(page).toHaveURL(/\/build-script$/);
	await character(page, 'Saint').tap();
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
	await page.goto('/library');
	// A search lists items from every folder, with where each one is.
	await search();
	await expect(libraryRows()).toHaveCount(1);
	await expect(libraryRows()).toContainText('Club night');

	// Back in the builder, the edit carries on without asking to replace it.
	await libraryRows().tap();
	await page
		.getByRole('dialog', { name: 'Edited here' })
		.getByRole('button', { name: 'Edit in Script builder' })
		.tap();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await expect(page.getByTestId('count-outsider')).toHaveText('1');

	// Save as new keeps the saved one as it was.
	await page.getByRole('textbox', { name: 'Name' }).fill('Edited here too');
	await saveNew.tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
	await page.goto('/library');
	await search();
	await expect(libraryRows()).toHaveCount(2);
});

// Trevor (2026-10-17): any saved script can be edited, and an edited copy says it is a variation.
test('editing a script made elsewhere saves a variation of it', async ({ page }) => {
	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([{ id: '_meta', name: 'Storm Front', author: 'Trevor' }, 'chef', 'imp'])
		)
	});
	await expect(page.getByRole('dialog', { name: 'Storm Front' })).toBeVisible();

	await page.goto('/build-script');
	const variation = page.getByTestId('variation-of');
	await expect(variation).toContainText('None');
	await page.getByRole('button', { name: 'Open a saved script' }).tap();
	await page.getByRole('dialog', { name: 'Open a saved script' }).getByText('Storm Front').tap();
	await expect(variation).toContainText('Storm Front');
	await character(page, 'Saint').tap();
	await page.getByRole('textbox', { name: 'Name' }).fill('Storm Front, calmer');
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

	// Saved with the original whole, so what changed can be shown.
	const source = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((done, fail) => {
			const open = indexedDB.open('grim-games-scripts');
			open.onsuccess = () => done(open.result);
			open.onerror = () => fail(open.error);
		});
		const all = await new Promise<{ name: string; source: unknown }[]>((done) => {
			const req = db.transaction('scripts').objectStore('scripts').getAll();
			req.onsuccess = () => done(req.result);
		});
		return all.find((s) => s.name === 'Storm Front, calmer')?.source;
	});
	expect(source).toMatchObject({
		kind: 'built',
		variationOf: { name: 'Storm Front', source: { kind: 'file', fileName: 'storm-front.json' } }
	});

	// The original is left as it was; the variation stays one when reopened.
	await page.reload();
	await expect(variation).toContainText('Storm Front');
});

// The shared page layout (Trevor, 2026-10-17): while the list scrolls, the counts and search
// stay in view just below the app header rather than sliding under it.
test('the counts and search stay below the app header while the list scrolls', async ({ page }) => {
	await page.goto('/build-script');
	await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
		'Script builder'
	);
	await expect(character(page, 'Imp')).toBeAttached();
	await page.evaluate(() => window.scrollBy(0, 4000));
	const header = (await page.getByRole('banner').boundingBox())!;
	const counts = (await page.getByTestId('builder-counts').boundingBox())!;
	expect(counts.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
	expect(counts.y).toBeLessThan(page.viewportSize()!.height);
});

// Trevor (2026-10-18): check sections with nothing in them start closed, and open when they
// gain something.
test('empty check sections are closed until they have something', async ({ page }) => {
	await page.goto('/build-script');
	const check = page.getByTestId('builder-check');
	const needs = check.getByRole('button', { name: 'Needs another character' });
	await expect(needs).toHaveAttribute('aria-expanded', 'false');
	await expect(check.getByRole('button', { name: 'Jinxes' })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	// Still opens by hand while empty.
	await needs.tap();
	await expect(needs).toHaveAttribute('aria-expanded', 'true');
	await needs.tap();

	await character(page, 'Choirboy').tap();
	await expect(needs).toHaveAttribute('aria-expanded', 'true');
	await expect(check.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
	await check.getByRole('button', { name: 'Add', exact: true }).tap();
	await expect(needs).toHaveAttribute('aria-expanded', 'false');
});

// Trevor, 2026-10-18: Add script on the builder too, so a script can be the base for a new
// one. It fills the builder (version included) and is not saved until the builder saves it;
// changes already on the builder are only replaced once confirmed.
test('Add script starts the builder from a script, without saving it', async ({ page }) => {
	await page.goto('/build-script');
	await character(page, 'Saint').tap();
	await page.getByLabel('Script file').setInputFiles({
		name: 'base.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([{ id: '_meta', name: 'Base', author: 'T', version: '2.1' }, 'chef', 'imp'])
		)
	});
	const confirm = page.getByRole('alertdialog', { name: 'Open Base?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Base');
	await expect(page.getByRole('textbox', { name: 'Version' })).toHaveValue('2.1');
	await expect(character(page, 'Saint')).toHaveAttribute('aria-pressed', 'false');
	await expect(page.getByTestId('count-demon')).toHaveText('1');
	await expect(page.getByTestId('variation-of')).toContainText('Base');
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
	await page.goto('/library');
	await expect(page.getByText('Base', { exact: true })).toHaveCount(0);
});

// Trevor, 2026-10-18: a version number, saved in the script and shown with its author.
test('the version is saved with the script and shown on its player view', async ({ page }) => {
	await page.goto('/build-script');
	await page.getByRole('textbox', { name: 'Name' }).fill('Versioned');
	await page.getByRole('textbox', { name: 'Author' }).fill('Trevor');
	await page.getByRole('textbox', { name: 'Version' }).fill('1.2');
	for (const name of ['Chef', 'Imp']) await character(page, name).tap();
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
	await page.goto('/play');
	await expect(page.getByTestId('script-byline')).toHaveText('by Trevor · v1.2');
});

// Trevor, 2026-10-18: only the chosen characters can be listed, still searchable, as in setup.
test('Show only selected lists just the chosen characters', async ({ page }) => {
	await page.goto('/build-script');
	for (const name of ['Chef', 'Empath', 'Imp']) await character(page, name).tap();
	const only = page.getByRole('button', { name: 'Show only selected' });
	await only.tap();
	await expect(only).toHaveAttribute('aria-pressed', 'true');
	await expect(character(page, 'Washerwoman')).toHaveCount(0);
	await expect(character(page, 'Chef')).toBeVisible();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await expect(character(page, 'Empath')).toBeVisible();
	await expect(character(page, 'Chef')).toHaveCount(0);
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('');
	await only.tap();
	await expect(character(page, 'Washerwoman')).toBeVisible();
});

// Trevor, 2026-10-18: when the counts take two lines, Travellers, Fabled and Loric are the
// second line together; the search's words are text, not the label font's capitals.
test('the counts split by kind, and the search reads as text', async ({ page }) => {
	await page.goto('/build-script');
	const top = async (type: string) => (await page.getByTestId(`count-${type}`).boundingBox())!.y;
	const [townsfolk, demon, traveller, fabled, loric] = await Promise.all(
		['townsfolk', 'demon', 'traveller', 'fabled', 'loric'].map(top)
	);
	expect(demon).toBe(townsfolk);
	expect(loric).toBe(traveller);
	expect(fabled).toBe(traveller);
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	const font = (el: Element) => getComputedStyle(el).fontFamily;
	expect(await search.evaluate(font)).toBe(await page.locator('body').evaluate(font));
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		page.viewportSize()!.width
	);
});

// Trevor, 2026-10-18: Official splits into the base three and Carousel, in the collection's
// place, so nothing moves.
test('Official lists the base three, Carousel, or both', async ({ page }) => {
	await page.goto('/build-script');
	const editions = page.getByRole('combobox', { name: 'Official editions' });
	await expect(character(page, 'Chef')).toBeVisible();
	await expect(character(page, 'Noble')).toBeVisible();
	await editions.tap();
	await page.getByRole('option', { name: 'Base three', exact: true }).tap();
	await expect(character(page, 'Noble')).toHaveCount(0);
	await expect(character(page, 'Chef')).toBeVisible();
	await editions.tap();
	await page.getByRole('option', { name: 'Carousel', exact: true }).tap();
	await expect(character(page, 'Chef')).toHaveCount(0);
	await expect(character(page, 'Noble')).toBeVisible();
});

// Trevor, 2026-10-18: a full or Teensyville script, and the counts each usually has
// (13/4/4/4 from TPI's "Behind the Curtain #6"; 6/2/2/2 from the wiki's Teensyville page).
test('the counts show what a full or Teensyville script usually has', async ({ page }) => {
	await page.goto('/build-script');
	await character(page, 'Chef').tap();
	await expect(page.getByTestId('expected-townsfolk')).toHaveText('/13');
	await expect(page.getByTestId('expected-demon')).toHaveText('/4');
	await expect(page.getByTestId('expected-traveller')).toHaveCount(0);
	await page.getByText('Teensyville', { exact: true }).tap();
	await expect(
		page.getByRole('checkbox', { name: 'Teensyville', includeHidden: true })
	).toBeChecked();
	await expect(page.getByTestId('expected-townsfolk')).toHaveText('/6');
	await expect(page.getByTestId('expected-outsider')).toHaveText('/2');
	await expect(page.getByTestId('expected-demon')).toHaveText('/2');
	// Remembered with the builder.
	await page.reload();
	await expect(page.getByTestId('expected-townsfolk')).toHaveText('/6');
});

// Trevor, 2026-10-18: see the script's JSON before downloading it; Save sits in the header.
test('Download shows the JSON first, with Copy and Download', async ({ page }) => {
	await page.goto('/build-script');
	await character(page, 'Imp').tap();
	await page.getByRole('button', { name: 'Download script JSON' }).tap();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByTestId('builder-json')).toContainText('"imp"');
	await expect(dialog.getByRole('button', { name: 'Copy JSON' })).toBeVisible();
	const download = page.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Download script JSON' }).tap();
	expect((await download).suggestedFilename()).toBe('script.json');
});

// Trevor, 2026-10-18: the type being scrolled through stays pinned under the search band.
test("each type's header stays pinned under the band while its characters scroll", async ({
	page
}) => {
	await page.goto('/build-script');
	const townsfolk = page.getByRole('button', { name: 'Townsfolk', exact: true });
	await expect(townsfolk).toBeVisible();
	await page.evaluate(() => window.scrollBy(0, 900));
	// Just under the band, whose last line is the search.
	const search = (await page.getByRole('searchbox', { name: 'Search characters' }).boundingBox())!;
	const head = (await townsfolk.boundingBox())!;
	expect(head.y).toBeGreaterThanOrEqual(search.y + search.height);
	expect(head.y).toBeLessThan(search.y + search.height + 40);
	// Closing it there keeps its header in view.
	await townsfolk.tap();
	await expect(townsfolk).toHaveAttribute('aria-expanded', 'false');
	await expect(townsfolk).toBeInViewport();
	await townsfolk.tap();
});

// Trevor, 2026-10-18: any character's page opens from its token, as in setup.
test("a character's token opens its page, and the row still chooses it", async ({ page }) => {
	await page.goto('/build-script');
	await page.getByRole('button', { name: 'About the Chef' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Chef' });
	await expect(dialog.getByRole('link', { name: 'Open wiki' })).toHaveAttribute(
		'href',
		/wiki\.bloodontheclocktower\.com\/Chef/
	);
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await character(page, 'Chef').tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
});
