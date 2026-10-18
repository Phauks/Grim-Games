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
	const collection = page.getByRole('combobox', { name: 'Homebrew Wiki collection' });
	await expect(collection).toBeVisible();
	await page.getByRole('combobox', { name: 'Characters from' }).tap();
	await page.getByRole('option', { name: 'Homebrew Wiki', exact: true }).tap();
	await expect(collection).toContainText('Temple Fair');
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
// only show under their own collection, so "On script" lists every chosen one together.
test('On script lists the chosen characters from every source together', async ({ page }) => {
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
	const picked = page.getByRole('combobox', { name: 'Homebrew Wiki collection' });
	await expect(picked).toContainText('Temple Fair');
	await character(page, 'Lantern, By DJ').tap();
	await picked.tap();
	await page.getByRole('option', { name: 'Night Market' }).tap();
	await character(page, 'Peddler, By Ana').tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('3');

	await page.getByRole('combobox', { name: 'Characters from' }).tap();
	await page.getByRole('option', { name: 'On script', exact: true }).tap();
	await expect(page.getByRole('listbox')).toBeHidden();
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
	// The new folder opens; the script is at the top level.
	await page
		.getByRole('navigation', { name: 'Folder path' })
		.getByRole('button', { name: 'Library' })
		.tap();
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
