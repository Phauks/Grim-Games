import { expect, test, type Locator, type Page } from '@playwright/test';

// Trevor (2026-10-16): a Library tab with every script the user has saved or made, folders and
// tags for them ("favorite", "wanna try", "stupid fun"). Trevor (2026-10-18): held like files in
// a file manager, with a sidebar, a table, drag and drop, and the open item to the right.

const homebrew = [
	{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
	'washerwoman',
	'chef',
	'saint',
	'poisoner',
	'imp'
];

const table = (page: Page) => page.getByTestId('library-table');
const row = (page: Page, name: string | RegExp = 'Storm Front') =>
	table(page).getByRole('button', {
		name: typeof name === 'string' ? new RegExp(`^${name}`) : name
	});
/**
 * Opens a row like Finder: one tap only selects, a double tap opens (Trevor, 2026-10-18:
 * "require double clicking to enter a folder or file").
 */
async function open(target: Locator) {
	await target.tap();
	await target.tap();
}
const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Folder path' });
const sidebar = (page: Page) => page.getByTestId('library-sidebar');
/** The open item: a pane beside the list on a computer, over the screen on a phone or tablet. */
const pane = (page: Page, name: string) =>
	page.getByRole('dialog', { name }).or(page.getByRole('region', { name }));

async function addScript(page: Page, script: unknown[] = homebrew) {
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(script))
	});
	const name = (script[0] as { name: string }).name;
	const opened = pane(page, name);
	await expect(opened).toBeVisible();
	return opened;
}

async function addStormFront(page: Page) {
	return addScript(page);
}

async function newFolder(page: Page, name: string) {
	await page.getByRole('button', { name: 'New folder' }).tap();
	const dialog = page.getByRole('dialog', { name: 'New folder' });
	await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
	await dialog.getByRole('textbox', { name: 'Name' }).press('Enter');
	await expect(dialog).toHaveCount(0);
}

/** The search opens from its button beside the folder controls (Trevor, 2026-10-18). */
async function search(page: Page, text: string) {
	const box = page.getByRole('searchbox', { name: 'Search the Library' });
	if (!(await box.isVisible()))
		await page.getByRole('button', { name: 'Search the Library' }).tap();
	await box.fill(text);
}

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('scripts sit in folders like files, and folders open, nest, move and delete', async ({
	page
}) => {
	// Trevor (2026-10-17): "hold scripts like files in a file manager".
	await page.goto('/library');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Library');
	await expect(page.getByRole('button', { name: 'Add script' })).toBeVisible();
	await (await addStormFront(page)).getByRole('button', { name: 'Close' }).tap();
	await expect(row(page)).toBeVisible();
	// The folder actions are there but unusable at the top level, so nothing moves on opening one.
	await expect(page.getByRole('button', { name: 'Delete folder' })).toBeDisabled();

	// A new folder is listed where it was made, not opened (Trevor, 2026-10-18); the
	// breadcrumb leads back.
	await newFolder(page, 'Club night');
	await expect(crumbs(page)).toHaveText('Home');
	await open(row(page, 'Club night'));
	await expect(crumbs(page)).toHaveText(/Home\s*\/\s*Club night/);
	await expect(table(page)).toContainText('None');
	await newFolder(page, 'Teensy');
	await expect(crumbs(page)).toHaveText(/Home\s*\/\s*Club night$/);
	await expect(row(page, 'Teensy')).toBeVisible();
	await crumbs(page).getByRole('button', { name: 'Home' }).tap();
	await expect(row(page, 'Club night')).toContainText('1 item');
	// The sidebar lists every folder with what it holds, and folders inside one fold away.
	await expect(sidebar(page).getByRole('button', { name: 'Teensy' })).toBeVisible();
	await expect(sidebar(page).getByRole('button', { name: /^Club night/ })).toContainText('1');
	await sidebar(page).getByRole('button', { name: 'Folders in Club night' }).tap();
	await expect(sidebar(page).getByRole('button', { name: /^Teensy/ })).toHaveCount(0);
	await sidebar(page).getByRole('button', { name: 'Folders in Club night' }).tap();
	await expect(sidebar(page).getByRole('button', { name: /^Teensy/ })).toBeVisible();
	await noSidewaysScroll(page);

	// A script goes in any folder from its own details.
	await open(row(page));
	const script = pane(page, 'Storm Front');
	await script.getByRole('combobox', { name: 'Folder' }).tap();
	await page.getByRole('option', { name: 'Club night / Teensy', exact: true }).tap();
	await script.getByRole('button', { name: 'Close' }).tap();
	await expect(row(page)).toHaveCount(0);
	await open(row(page, 'Club night'));
	await open(row(page, 'Teensy'));
	await expect(row(page)).toBeVisible();

	// Search finds items in every folder and says where each one is.
	await crumbs(page).getByRole('button', { name: 'Home' }).tap();
	await search(page, 'washerwoman');
	await expect(row(page)).toContainText('Club night / Teensy');
	await page.getByRole('searchbox', { name: 'Search the Library' }).fill('');

	// Kept on the device.
	await page.reload();
	await open(row(page, 'Club night'));
	await open(row(page, 'Teensy'));

	// Rename, then move the open folder to the top level.
	await page.getByRole('button', { name: 'Rename Teensy' }).tap();
	const rename = page.getByRole('dialog', { name: 'Rename' });
	await rename.getByRole('textbox', { name: 'Name' }).fill('Small games');
	await rename.getByRole('button', { name: 'Confirm' }).tap();
	await page.getByRole('button', { name: 'Move Small games' }).tap();
	const move = page.getByRole('dialog', { name: 'Move Small games' });
	await move.getByRole('combobox', { name: 'Move to' }).tap();
	await expect(page.getByRole('option', { name: 'Club night / Small games' })).toHaveCount(0);
	await page.getByRole('option', { name: 'Home', exact: true }).tap();
	await move.getByRole('button', { name: 'Confirm' }).tap();
	await expect(crumbs(page)).toHaveText(/Home\s*\/\s*Small games$/);

	// Deleting a folder asks, and what it held moves up a level.
	await page.getByRole('button', { name: 'Delete Small games' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete folder?' });
	await expect(confirm).toContainText('What it holds moves to Home.');
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(crumbs(page)).toHaveText('Home');
	await expect(row(page)).toBeVisible();
	await expect(row(page, 'Club night')).toContainText('0 items');
});

test('one tap selects a row and a double tap opens it; a selected folder is renamed from outside', async ({
	page
}) => {
	// Trevor (2026-10-18): "require double clicking to enter a folder or file. allow renaming a
	// folder", "from outside the folder".
	await page.goto('/library');
	await (await addStormFront(page)).getByRole('button', { name: 'Close' }).tap();
	await newFolder(page, 'Club night');

	// One tap: selected, not opened.
	await row(page).tap();
	await expect(table(page).locator('tr.selected')).toContainText('Storm Front');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await row(page, 'Club night').tap();
	await expect(crumbs(page)).toHaveText('Home');

	// The folder controls now act on the selected folder, from where it is listed.
	await page.getByRole('button', { name: 'Rename Club night' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Rename' });
	await dialog.getByRole('textbox', { name: 'Name' }).fill('Late night');
	await dialog.getByRole('textbox', { name: 'Name' }).press('Enter');
	await expect(row(page, 'Late night')).toBeVisible();
	await expect(crumbs(page)).toHaveText('Home');

	// F2 on a folder row renames it too; a name already used beside it is refused.
	await newFolder(page, 'Done');
	await row(page, 'Late night').focus();
	await page.keyboard.press('F2');
	await dialog.getByRole('textbox', { name: 'Name' }).fill('Done');
	await expect(dialog.getByText('That name is already used.')).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Cancel' }).tap();

	// A double tap opens: the folder is entered, a file opens in a window.
	await open(row(page, 'Late night'));
	await expect(crumbs(page)).toHaveText(/Home\s*\/\s*Late night$/);
	await crumbs(page).getByRole('button', { name: 'Home' }).tap();
	await open(row(page));
	await expect(pane(page, 'Storm Front')).toBeVisible();
});

test('tags live in the sidebar: add, filter by, delete; and a script can be removed', async ({
	page
}) => {
	// Trevor (2026-10-18): tags in "the left side bar of the file nav".
	await page.goto('/library');
	await (await addStormFront(page)).getByRole('button', { name: 'Close' }).tap();
	await newFolder(page, 'Club night');
	await noSidewaysScroll(page);

	const side = sidebar(page);
	const tags = side.getByRole('list', { name: 'Tags' });
	// Compact (Trevor, 2026-10-18: "it is so big"): New tag and Manage tags open dialogs.
	await side.getByRole('button', { name: 'New tag' }).tap();
	const naming = page.getByRole('dialog', { name: 'New tag' });
	await naming.getByPlaceholder('New tag').fill('Stupid fun');
	await naming.getByPlaceholder('New tag').press('Enter');
	await expect(naming).toHaveCount(0);
	await side.getByRole('button', { name: 'New tag' }).tap();
	await naming.getByPlaceholder('New tag').fill('stupid FUN');
	await expect(naming.getByText('That name is already used.')).toBeVisible();
	// What is typed looks like the tag it makes (Trevor, 2026-10-18: the same font).
	const fontOf = (el: Element) => getComputedStyle(el).fontFamily;
	const typedFont = await naming.getByPlaceholder('New tag').evaluate(fontOf);
	await naming.getByPlaceholder('New tag').fill('Wanna try');
	await naming.getByRole('button', { name: 'Add' }).tap();
	await expect(tags.getByRole('listitem')).toHaveText(['Stupid fun', 'Wanna try']);
	expect(await tags.getByRole('button', { name: 'Stupid fun', exact: true }).evaluate(fontOf)).toBe(
		typedFont
	);

	// An item sits in one folder and carries any tags.
	await open(row(page));
	const script = pane(page, 'Storm Front');
	await script.getByRole('combobox', { name: 'Folder' }).tap();
	await page.getByRole('option', { name: 'Club night' }).tap();
	const fun = script.getByRole('button', { name: 'Stupid fun', exact: true });
	await fun.tap();
	await expect(fun).toHaveAttribute('aria-pressed', 'true');
	// Every saved script opens in the Script builder (Trevor, 2026-10-17).
	await expect(script.getByRole('button', { name: 'Edit in Script builder' })).toBeEnabled();
	await expect(script.getByTestId('script-sheet')).toContainText('Washerwoman');
	await script.getByRole('button', { name: 'Close' }).tap();

	// A tag in the sidebar shows what carries it, from every folder.
	await tags.getByRole('button', { name: 'Wanna try', exact: true }).tap();
	await expect(row(page)).toHaveCount(0);
	await tags.getByRole('button', { name: 'Wanna try', exact: true }).tap();
	await tags.getByRole('button', { name: 'Stupid fun', exact: true }).tap();
	await expect(row(page)).toContainText('Club night');
	await page.reload();
	await expect(row(page)).toHaveCount(0);

	// Deleting a tag, in Manage tags, asks, then takes it off the item, which stays.
	await side.getByRole('button', { name: 'Manage tags' }).tap();
	const manage = page.getByRole('dialog', { name: 'Manage tags' });
	await manage.getByRole('button', { name: 'Delete Stupid fun' }).tap();
	const confirmTag = page.getByRole('alertdialog', { name: 'Delete tag?' });
	await expect(confirmTag).toContainText('taken off 1 item');
	await confirmTag.getByRole('button', { name: 'Confirm' }).tap();
	await manage.getByRole('button', { name: 'Close' }).tap();
	await expect(tags.getByRole('listitem')).toHaveText(['Wanna try']);

	// Removing a script asks first.
	await open(row(page, 'Club night'));
	await open(row(page));
	await expect(script.getByRole('button', { name: 'Stupid fun', exact: true })).toHaveCount(0);
	await script.getByRole('button', { name: 'Remove script' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Remove script?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(row(page)).toHaveCount(0);
	await expect(table(page)).toContainText('None');
});

test('a saved script can be renamed in the Library and still knows where it came from', async ({
	page
}) => {
	// Trevor (2026-10-18): "allow renaming scripts saved in library (but still remember source)".
	await page.goto('/library');
	const script = await addStormFront(page);
	await script.getByRole('button', { name: 'Rename script' }).tap();
	const naming = page.getByRole('dialog', { name: 'Rename script' });
	await naming.getByRole('textbox', { name: 'Name' }).fill('Club storm');
	await naming.getByRole('textbox', { name: 'Name' }).press('Enter');
	await expect(pane(page, 'Club storm')).toBeVisible();
	await pane(page, 'Club storm').getByRole('button', { name: 'Close' }).tap();
	await expect(row(page, 'Club storm')).toBeVisible();
	await page.reload();
	await expect(row(page, 'Club storm')).toBeVisible();
	// Its own name still finds it.
	await search(page, 'storm front');
	await expect(row(page, 'Club storm')).toBeVisible();

	// Empty Campaigns look like the rest: the same table, saying None (Trevor, 2026-10-18).
	await sidebar(page).getByRole('button', { name: 'Campaigns' }).tap();
	await expect(page.getByTestId('library-campaigns').getByRole('table')).toContainText('None');
	await expect(page.getByRole('button', { name: 'Search the Library' })).toBeVisible();
});

test('a script added inside an open folder goes in that folder', async ({ page }) => {
	await page.goto('/library');
	await newFolder(page, 'Club night');
	await open(row(page, 'Club night'));
	await (await addStormFront(page)).getByRole('button', { name: 'Close' }).tap();
	await expect(row(page)).toBeVisible();
	await crumbs(page).getByRole('button', { name: 'Home' }).tap();
	await expect(row(page)).toHaveCount(0);
});

test('a row dragged onto a folder moves into it, by touch too', async ({ page }) => {
	// Trevor (2026-10-18): "drag and drop files around into folders". A held touch drags.
	await page.goto('/library');
	await (await addStormFront(page)).getByRole('button', { name: 'Close' }).tap();
	await newFolder(page, 'Club night');
	// Touches land on the screen, so the rows must be on it.
	await row(page).scrollIntoViewIfNeeded();

	const from = await row(page).boundingBox();
	const to = await row(page, 'Club night').boundingBox();
	if (!from || !to) throw new Error('rows not laid out');
	const cdp = await page.context().newCDPSession(page);
	const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
		cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
		});
	const start = { x: from.x + 40, y: from.y + from.height / 2 };
	const end = { x: to.x + 40, y: to.y + to.height / 2 };
	await touch('touchStart', start.x, start.y);
	await page.waitForTimeout(600);
	for (let i = 1; i <= 8; i++) {
		await touch(
			'touchMove',
			start.x + ((end.x - start.x) * i) / 8,
			start.y + ((end.y - start.y) * i) / 8
		);
	}
	await expect(row(page, 'Club night')).toHaveAttribute('data-drop-over', '');
	await touch('touchEnd', end.x, end.y);

	await expect(row(page)).toHaveCount(0);
	await expect(row(page, 'Club night')).toContainText('1 item');
	// No item opened: the drag's release isn't a tap.
	await expect(pane(page, 'Storm Front')).toHaveCount(0);
	await open(row(page, 'Club night'));
	await expect(row(page)).toBeVisible();
});

test('characters and character collections are Library items too', async ({ page }) => {
	// Trevor (2026-10-18): "designate files as scripts, characters, or character collections".
	await page.goto('/build-character');
	await page.getByTestId('character-name').fill('Lamp Lighter');
	await page.getByTestId('character-ability').fill('Each night, learn something.');
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

	await page.goto('/library');
	await sidebar(page).getByRole('button', { name: 'Characters', exact: true }).tap();
	await expect(table(page).locator('tbody tr')).toHaveCount(1);
	await open(row(page, 'Lamp Lighter'));
	const character = pane(page, 'Lamp Lighter');
	await expect(character.getByTestId('library-character')).toContainText('learn something');

	// A collection is a named set of characters, official or the user's own.
	await character.getByRole('button', { name: 'Close' }).tap();
	await page.getByRole('button', { name: 'New collection' }).tap();
	const naming = page.getByRole('dialog', { name: 'New collection' });
	await naming.getByRole('textbox', { name: 'Name' }).fill('Lamp set');
	await naming.getByRole('textbox', { name: 'Name' }).press('Enter');
	const collection = pane(page, 'Lamp set');
	await expect(collection.getByTestId('library-collection')).toContainText('None');
	await collection.getByRole('button', { name: 'Choose characters' }).tap();
	const choose = page.getByRole('dialog', { name: 'Choose characters' });
	await choose.getByRole('button', { name: /^Chef/ }).first().tap();
	await choose
		.getByRole('button', { name: /^Lamp Lighter/ })
		.first()
		.tap();
	await choose.getByRole('button', { name: 'Close' }).tap();
	const members = collection.getByRole('list', { name: 'Characters' });
	await expect(members.getByRole('listitem')).toHaveCount(2);
	await expect(members).toContainText('Chef');
	await expect(members).toContainText('Lamp Lighter');
	await collection.getByRole('button', { name: 'Close' }).tap();

	await sidebar(page).getByRole('button', { name: 'Character Collections' }).tap();
	await expect(row(page, 'Lamp set')).toContainText('2 characters');
	await page.reload();
	await sidebar(page).getByRole('button', { name: 'Everything' }).tap();
	await expect(row(page, 'Lamp set')).toBeVisible();
	await expect(row(page, 'Lamp Lighter')).toBeVisible();

	// Deleting a collection asks; its characters stay.
	await open(row(page, 'Lamp set'));
	await collection.getByRole('button', { name: 'Delete collection' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Delete collection?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(row(page, 'Lamp set')).toHaveCount(0);
	await expect(row(page, 'Lamp Lighter')).toBeVisible();

	// A character opens in the Character builder, over the Library, from its header.
	await open(row(page, 'Lamp Lighter'));
	await character.getByRole('button', { name: 'Edit character' }).tap();
	const builder = page.getByRole('dialog', { name: 'Edit character' });
	await expect(builder.getByTestId('character-name')).toHaveValue('Lamp Lighter');
	await expect(page).toHaveURL(/\/library/);
});

test('a script saved without a name is named after the time it was saved', async ({ page }) => {
	// Trevor (2026-10-18): "do not allow uploading or saving a file without a name. if no name,
	// assign timestamp name".
	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'nameless.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify([{ id: '_meta', name: '' }, 'chef', 'imp']))
	});
	const timeName = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
	await expect(
		page.getByRole('dialog', { name: timeName }).or(page.getByRole('region', { name: timeName }))
	).toBeVisible();
});

test('the sidebar’s folders, kinds and tags fold away, and folders are made there', async ({
	page
}) => {
	// Trevor (2026-10-18): "allow collapsing of folders, kind, and tags" and "move add folder
	// button into left sidebar, in nav area".
	await page.goto('/library');
	const nav = sidebar(page);
	await expect(nav.getByRole('button', { name: 'New folder' })).toBeVisible();
	await newFolder(page, 'Club night');
	await expect(nav.getByRole('button', { name: /^Club night/ })).toBeVisible();

	for (const [group, inside] of [
		['Folders', /^Club night/],
		['Kinds', /^Scripts/],
		['Tags', 'New tag']
	] as const) {
		const head = nav.getByRole('button', { name: group, exact: true });
		await expect(head).toHaveAttribute('aria-expanded', 'true');
		await head.tap();
		await expect(head).toHaveAttribute('aria-expanded', 'false');
		if (group !== 'Tags') await expect(nav.getByRole('button', { name: inside })).toBeHidden();
	}
	// Remembered on this device.
	await page.reload();
	await expect(nav.getByRole('button', { name: 'Kinds', exact: true })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await nav.getByRole('button', { name: 'Kinds', exact: true }).tap();
	await expect(nav.getByRole('button', { name: /^Scripts/ })).toBeVisible();
});

test('an item changes kind, told first what won’t carry over', async ({ page }) => {
	// Trevor (2026-10-18): "allow changing type of file from character collection to script or
	// character, but note if being changed to incompatible format".
	await page.goto('/library');
	await page.getByRole('button', { name: 'New collection' }).tap();
	const naming = page.getByRole('dialog', { name: 'New collection' });
	await naming.getByRole('textbox', { name: 'Name' }).fill('Lamp set');
	await naming.getByRole('textbox', { name: 'Name' }).press('Enter');
	const collection = pane(page, 'Lamp set');
	await collection.getByRole('button', { name: 'Choose characters' }).tap();
	const choose = page.getByRole('dialog', { name: 'Choose characters' });
	await choose.getByRole('button', { name: /^Chef/ }).first().tap();
	await choose.getByRole('button', { name: /^Imp/ }).first().tap();
	await choose.getByRole('button', { name: 'Close' }).tap();

	// Into a script: everything carries over.
	await collection.getByRole('button', { name: 'Change kind' }).tap();
	let dialog = page.getByRole('dialog', { name: 'Change kind' });
	await expect(dialog.getByRole('combobox', { name: 'New kind' })).toContainText('Script');
	await expect(dialog).toContainText('Everything carries over.');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	const script = pane(page, 'Lamp set');
	await expect(script.getByRole('button', { name: 'Rename script' })).toBeVisible();

	// Into a character: official characters can't become one, so it says why and won't go.
	await script.getByRole('button', { name: 'Change kind' }).tap();
	dialog = page.getByRole('dialog', { name: 'Change kind' });
	await dialog.getByRole('combobox', { name: 'New kind' }).tap();
	await page.getByRole('option', { name: 'Character', exact: true }).tap();
	await expect(dialog).toContainText('It has no character of its own');
	await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();

	// Back into a collection.
	await dialog.getByRole('combobox', { name: 'New kind' }).tap();
	await page.getByRole('option', { name: 'Character Collection', exact: true }).tap();
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(
		pane(page, 'Lamp set').getByRole('list', { name: 'Characters' }).getByRole('listitem')
	).toHaveCount(2);
	// The one item, not a copy beside the old one.
	await pane(page, 'Lamp set').getByRole('button', { name: 'Close' }).tap();
	await expect(row(page, 'Lamp set')).toHaveCount(1);
});

test.describe('in a computer window', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('the open item sits to the right, and a row drags onto a sidebar folder', async ({
		page
	}) => {
		// Trevor (2026-10-18): "open it to the right side, not as a modal".
		await page.goto('/library');
		await addStormFront(page);
		await addScript(page, [{ id: '_meta', name: 'Pocket Storm' }, 'chef', 'saint', 'imp']);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(pane(page, 'Pocket Storm')).toBeVisible();
		// Another row swaps what the pane shows; nothing to close first.
		await row(page).click();
		await expect(pane(page, 'Storm Front').getByTestId('script-sheet')).toContainText(
			'Washerwoman'
		);
		// Its controls are in the header (Trevor, 2026-10-18).
		const header = pane(page, 'Storm Front').getByTestId('script-details-top');
		for (const name of ['Play', 'Print script', 'Share script', 'Edit in Script builder']) {
			await expect(header.getByRole('button', { name, exact: true })).toBeVisible();
		}
		await expect(table(page).locator('tr.selected')).toContainText('Storm Front');

		await newFolder(page, 'Club night');
		const target = sidebar(page).getByRole('button', { name: 'Club night' });
		await row(page).hover();
		await page.mouse.down();
		await target.hover({ force: true });
		await expect(target).toHaveAttribute('data-drop-over', '');
		await page.mouse.up();
		await expect(row(page)).toHaveCount(0);
		await target.click();
		await expect(row(page)).toBeVisible();
		await noSidewaysScroll(page);
	});

	test('sidebar folders drag onto other folders, by mouse or touch, but never into themselves', async ({
		page
	}) => {
		// Trevor (2026-10-18): "allow dragging and dropping folders in the left side bar".
		await page.goto('/library');
		await addStormFront(page);
		await newFolder(page, 'Club night');
		await newFolder(page, 'Done');
		const folder = (name: string) =>
			sidebar(page).getByRole('button', { name: new RegExp(`^${name}`) });
		const top = sidebar(page).getByRole('button', { name: /^Home/ });

		// A mouse drags Done into Club night: it nests, and its caret appears.
		await folder('Done').hover();
		await page.mouse.down();
		await folder('Club night').hover({ force: true });
		await expect(folder('Club night')).toHaveAttribute('data-drop-over', '');
		await page.mouse.up();
		await expect(
			sidebar(page).getByRole('button', { name: 'Folders in Club night' })
		).toBeVisible();
		await expect(sidebar(page).locator('li.folder', { hasText: 'Done' })).toHaveCSS('--depth', '1');

		// A held touch drags Club night onto Done, inside it: it stays put and says why.
		const from = await folder('Club night').boundingBox();
		const to = await folder('Done').boundingBox();
		if (!from || !to) throw new Error('folders not laid out');
		const cdp = await page.context().newCDPSession(page);
		const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
			cdp.send('Input.dispatchTouchEvent', {
				type,
				touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
			});
		const start = { x: from.x + 40, y: from.y + from.height / 2 };
		const end = { x: to.x + 60, y: to.y + to.height / 2 };
		await touch('touchStart', start.x, start.y);
		await page.waitForTimeout(600);
		for (let i = 1; i <= 6; i++) {
			await touch(
				'touchMove',
				start.x + ((end.x - start.x) * i) / 6,
				start.y + ((end.y - start.y) * i) / 6
			);
		}
		await touch('touchEnd', end.x, end.y);
		await expect(page.getByText('Club night can’t go inside itself.')).toBeVisible();
		await expect(sidebar(page).locator('li.folder', { hasText: 'Club night' })).toHaveCSS(
			'--depth',
			'0'
		);
		// The drag's release didn't open the folder either.
		await expect(crumbs(page)).toHaveText('Home');

		// Onto the Library at the top, Done comes back out.
		await folder('Done').hover();
		await page.mouse.down();
		await top.hover({ force: true });
		await expect(top).toHaveAttribute('data-drop-over', '');
		await page.mouse.up();
		await expect(sidebar(page).getByRole('button', { name: 'Folders in Club night' })).toHaveCount(
			0
		);
		await expect(sidebar(page).locator('li.folder', { hasText: 'Done' })).toHaveCSS('--depth', '0');
	});

	test('Preview shows or hides the pane, and any item opens in a window', async ({ page }) => {
		// Trevor (2026-10-18): "add a preview button ... regardless, you should be able to click
		// into a file to see its contents in a modal".
		await page.goto('/library');
		await addStormFront(page);
		const toggle = page.getByRole('button', { name: 'Preview', exact: true });
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		// One line of headers beside the pane (Trevor's screenshot had Tags wrapping under).
		// (A narrow table's own row of moved filters, `th.moved`, sits under it by design.)
		const tops = await table(page)
			.locator('thead th:not(.moved)')
			.evaluateAll((cells) =>
				cells.flatMap((c) => {
					const box = c.getBoundingClientRect();
					return box.width > 0 ? [Math.round(box.top)] : [];
				})
			);
		expect(new Set(tops).size).toBe(1);

		// From the preview, Open puts the same item in a window; closing it keeps the preview.
		await pane(page, 'Storm Front').getByRole('button', { name: 'Open in a window' }).click();
		const window = page.getByRole('dialog', { name: 'Storm Front' });
		await expect(window.getByTestId('script-sheet')).toContainText('Washerwoman');
		await window.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page.getByRole('region', { name: 'Storm Front' })).toBeVisible();
		// A double-click opens the window too.
		await row(page).dblclick();
		await expect(window).toBeVisible();
		await window.getByRole('button', { name: 'Close' }).click();

		// Off: no pane, the list takes the room, and a tap opens the window. Remembered.
		const listWidth = await table(page).evaluate((t) => t.getBoundingClientRect().width);
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByTestId('library-pane')).toHaveCount(0);
		expect(await table(page).evaluate((t) => t.getBoundingClientRect().width)).toBeGreaterThan(
			listWidth
		);
		await page.reload();
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await row(page).dblclick();
		await expect(window.getByTestId('script-sheet')).toContainText('Washerwoman');
		await window.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await toggle.click();
		await expect(page.getByTestId('library-pane')).toBeVisible();
	});
});

test('search opens from its button over the folder path, and folds away', async ({ page }) => {
	// Trevor (2026-10-18): "move search next to the pencil icon, when clicked, expand".
	await page.goto('/library');
	await (await addStormFront(page)).getByRole('button', { name: 'Close' }).tap();
	const button = page.getByRole('button', { name: 'Search the Library' });
	const box = page.getByRole('searchbox', { name: 'Search the Library' });
	await expect(box).toBeHidden();
	// Where nothing fits beside the list, items always open in a window: Preview rests.
	await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeDisabled();
	const listTop = () => table(page).evaluate((t) => t.getBoundingClientRect().top + scrollY);
	const before = await listTop();

	await button.tap();
	await expect(box).toBeFocused();
	await box.fill('nothing like it');
	await expect(table(page)).toContainText('None');
	// Opened in the path's place: the list doesn't move.
	expect(await listTop()).toBe(before);
	// A typed search stays open and marks the button.
	await page.getByRole('heading', { level: 1 }).tap();
	await expect(box).toBeVisible();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	// Esc clears it (as every search field does), then a second Esc folds it away.
	await box.press('Escape');
	await expect(box).toHaveValue('');
	await box.press('Escape');
	await expect(box).toBeHidden();
	await expect(button).toHaveAttribute('aria-pressed', 'false');
	await expect(row(page)).toBeVisible();
	await expect(crumbs(page)).toHaveText('Home');
});

test('a script shows the same details as in Search, and plays from there', async ({ page }) => {
	// Trevor (2026-10-17): "exact same info and style as in the search".
	await page.goto('/library');
	const script = await addStormFront(page);
	const details = script.getByTestId('script-details');
	for (const fact of ['Author', 'Type', 'Source', 'Version', 'Folder', 'Tags']) {
		await expect(details.getByRole('term').filter({ hasText: fact }).first()).toBeVisible();
	}
	await expect(script.getByTestId('script-checks')).toBeVisible();
	await expect(script.getByTestId('script-sheet')).toContainText('Washerwoman');
	await expect(script.getByRole('button', { name: 'Print script' })).toBeVisible();
	await expect(script.getByRole('button', { name: 'Share script' })).toBeVisible();
	await script.getByRole('button', { name: 'Play', exact: true }).tap();
	await expect(page).toHaveURL(/\/new$/);
});

test('a long script scrolls to its end in the Library', async ({ page }) => {
	// Trevor (2026-10-18): "While viewing script in library, cannot scroll."
	await page.goto('/library');
	const long = [
		{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
		...['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller'],
		...['undertaker', 'monk', 'ravenkeeper', 'virgin', 'slayer', 'soldier', 'mayor'],
		...['butler', 'drunk', 'recluse', 'saint', 'poisoner', 'spy', 'scarletwoman', 'baron', 'imp']
	];
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(long))
	});
	const script = pane(page, 'Storm Front');
	await expect(script.getByTestId('script-sheet')).toContainText('Imp');
	const scroller = script.getByTestId('library-pane');
	expect(
		await scroller.evaluate((el) => el.scrollHeight > el.clientHeight),
		'the script is longer than the dialog'
	).toBe(true);
	await scroller.hover();
	await page.mouse.wheel(0, 20000);
	await expect
		.poll(() => scroller.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2))
		.toBe(true);
	await expect(
		script.getByTestId('script-sheet').getByText('Imp', { exact: true }).last()
	).toBeInViewport();
	await noSidewaysScroll(page);
});

test('a script made in the Script builder opens there from the Library', async ({ page }) => {
	await page.goto('/build-script');
	await page.getByRole('textbox', { name: 'Name' }).fill('Built here');
	for (const name of ['Chef', 'Imp']) {
		await page.getByTestId('character-picker').getByRole('button', { name, exact: true }).tap();
	}
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Clear the script' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Clear the script?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();

	await page.goto('/library');
	await open(row(page, 'Built here'));
	await pane(page, 'Built here').getByRole('button', { name: 'Edit in Script builder' }).tap();
	await expect(page).toHaveURL(/\/build-script$/);
	await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Built here');
	await expect(page.getByTestId('count-demon')).toHaveText('1');
});

test('a saved BotC Scripts script still offers its other versions', async ({ page }) => {
	// Trevor (2026-10-17): a script saved at one version can still open all the others.
	const content = (version: string) => [
		{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
		...homebrew.slice(1),
		...(version === '1.1.0' ? ['mayor'] : [])
	];
	await page.route(/\/api\/botcscripts\/search\?/, (route) =>
		route.fulfill({
			json: {
				page: 1,
				count: 1,
				hasMore: false,
				results: [
					{
						scriptId: 1900,
						versionId: 900,
						name: 'Storm Front',
						version: '1.0.0',
						author: 'Trevor',
						type: 'Full',
						score: 5,
						characters: [{ id: 'chef' }, { id: 'imp' }]
					}
				]
			}
		})
	);
	await page.route('**/api/botcscripts/versions/1900', (route) =>
		route.fulfill({ json: { scriptId: 1900, latest: '1.1.0', versions: ['1.1.0', '1.0.0'] } })
	);
	await page.route(/\/api\/botcscripts\/(version\/900|script\/1900\/1\.[01]\.0)$/, (route) => {
		const version = route.request().url().endsWith('1.1.0') ? '1.1.0' : '1.0.0';
		return route.fulfill({
			json: {
				scriptId: 1900,
				versionId: version === '1.1.0' ? 901 : 900,
				name: 'Storm Front',
				version,
				author: 'Trevor',
				content: content(version)
			}
		});
	});

	// Saved from Search at 1.0.0, searching BotC Scripts alone (the other sources aren't routed).
	await page.addInitScript(() =>
		localStorage.setItem('grim-games:scripts:sources', JSON.stringify(['botc']))
	);
	await page.goto('/scripts');
	await page
		.getByRole('table', { name: 'Scripts' })
		.getByRole('button', { name: /^Storm Front/ })
		.tap();
	const search = page.getByRole('complementary', { name: 'Script details' });
	await expect(search.getByTestId('script-sheet')).toContainText('Washerwoman');
	await search.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(search.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.goto('/library');
	await open(row(page));
	const script = pane(page, 'Storm Front');
	const save = script.getByRole('button', { name: 'Save', exact: true });
	const remove = script.getByRole('button', { name: 'Remove script' });
	// One place for Save and Remove: only the one that applies is there (Trevor, 2026-10-18).
	await expect(save).toHaveCount(0);
	await expect(remove).toBeEnabled();
	await expect(script.getByTestId('newer-version').getByRole('button')).toHaveText('Newer: 1.1.0');
	await script.getByRole('combobox', { name: 'Version' }).tap();
	await page.getByRole('option', { name: /^1\.1\.0/ }).tap();
	await expect(script.getByTestId('script-sheet')).toContainText('Mayor');
	// Only a preview until saved: the Library still holds 1.0.0, so Save takes Remove's place.
	await expect(save).toBeVisible();
	await expect(remove).toHaveCount(0);
	await script.getByRole('button', { name: 'Close' }).tap();
	await expect(row(page)).toHaveCount(1);

	// Saving another version keeps both.
	await open(row(page));
	await script.getByRole('combobox', { name: 'Version' }).tap();
	await page.getByRole('option', { name: /^1\.1\.0/ }).tap();
	await save.tap();
	await expect(remove).toBeVisible();
	await expect(save).toHaveCount(0);
	await script.getByRole('button', { name: 'Close' }).tap();
	await expect(row(page)).toHaveCount(2);
});

test('a script edited in the Script builder is marked as a variation, with what changed', async ({
	page
}) => {
	// Trevor (2026-10-17): an edited script says it is a variation, and shows what the variation is.
	await page.goto('/library');
	await (await addStormFront(page)).getByRole('button', { name: 'Edit in Script builder' }).tap();
	await expect(page).toHaveURL(/\/build-script$/);
	await page.getByRole('textbox', { name: 'Name' }).fill('Storm Front (no Saint)');
	await page
		.getByTestId('character-picker')
		.getByRole('button', { name: 'Saint', exact: true })
		.tap();
	await page
		.getByTestId('character-picker')
		.getByRole('button', { name: 'Mayor', exact: true })
		.tap();
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();

	await page.goto('/library');
	// The original stays in the Library beside the variation.
	await expect(row(page)).toHaveCount(2);
	await open(row(page, /^Storm Front \(no Saint\)/));
	const script = pane(page, 'Storm Front (no Saint)');
	await expect(script.getByTestId('variation-of')).toContainText('Storm Front');
	await script.getByRole('button', { name: 'What changed' }).tap();
	const changes = page.getByTestId('variation-changes');
	await expect(changes).toContainText('Storm Front (no Saint)');
	await expect(changes.getByRole('definition').nth(4)).toContainText('Mayor');
	await expect(changes.getByRole('definition').nth(5)).toContainText('Saint');
	await noSidewaysScroll(page);
});

test('a file of homebrew characters is guessed as a collection or a character, with the reason', async ({
	page
}) => {
	// Trevor, 2026-10-22 (backlog L23): "show guess with a dropdown, show reason for choice".
	const character = (id: string, name: string) => ({
		id,
		name,
		team: 'townsfolk',
		ability: 'Each night, learn a number.'
	});
	const upload = (name: string, json: unknown) =>
		page.getByLabel('Script file').setInputFiles({
			name,
			mimeType: 'application/json',
			buffer: Buffer.from(JSON.stringify(json))
		});
	await page.goto('/library');
	const dialog = page.getByRole('dialog', { name: 'Add to the Library' });
	const kind = dialog.getByRole('combobox', { name: 'Add as' });

	await upload('bakers.json', [character('baker', 'Baker'), character('miller', 'Miller')]);
	await expect(kind).toHaveText('Character Collection');
	await expect(dialog.getByTestId('kind-reason')).toHaveText(
		'No script details and only homebrew characters.'
	);
	await noSidewaysScroll(page);
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(pane(page, 'bakers')).toBeVisible();
	await page.keyboard.press('Escape');

	await upload('cook.json', character('cook', 'Cook'));
	await expect(kind).toHaveText('Character');
	await expect(dialog.getByTestId('kind-reason')).toHaveText('A single character, not a list.');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(pane(page, 'Cook')).toBeVisible();
	await page.keyboard.press('Escape');

	// A wrong guess is one choice to fix: the same file added as a script.
	await upload('pair.json', [character('tailor', 'Tailor'), character('weaver', 'Weaver')]);
	await kind.tap();
	await page.getByRole('option', { name: 'Script' }).tap();
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	// As a script it goes through the Script check like any other.
	await expect(page.getByRole('dialog', { name: 'Script check' })).toBeVisible();
});
