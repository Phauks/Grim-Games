import { expect, test, type Page } from '@playwright/test';

// Trevor (2026-10-16): a Library tab with every script the user has saved or made, folders and
// tags for them ("favorite", "wanna try", "stupid fun"), and their own info tokens.

const homebrew = [
	{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
	'washerwoman',
	'chef',
	'saint',
	'poisoner',
	'imp'
];

const table = (page: Page) => page.getByTestId('library-table');
const row = (page: Page) => table(page).getByRole('button', { name: /^Storm Front/ });
const tiles = (page: Page) => page.getByTestId('library-folders');
const tile = (page: Page, name: string | RegExp) =>
	tiles(page).getByRole('button', {
		name: typeof name === 'string' ? new RegExp(`^${name}`) : name
	});
const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Folder path' });

async function addStormFront(page: Page) {
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	const dialog = page.getByRole('dialog', { name: 'Storm Front' });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function newFolder(page: Page, name: string) {
	await page.getByRole('button', { name: 'New folder' }).tap();
	const dialog = page.getByRole('dialog', { name: 'New folder' });
	await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
	await dialog.getByRole('textbox', { name: 'Name' }).press('Enter');
	await expect(dialog).toHaveCount(0);
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
	await expect(page.getByRole('radio', { name: 'Folders' })).toBeChecked();
	await expect(tile(page, 'Storm Front')).toBeVisible();
	// The folder actions are there but unusable at the top level, so nothing moves on opening one.
	await expect(page.getByRole('button', { name: 'Delete folder' })).toBeDisabled();

	// A new folder opens; a folder inside it opens too, and the breadcrumb leads back.
	await newFolder(page, 'Club night');
	await expect(crumbs(page)).toHaveText(/Scripts\s*\/\s*Club night/);
	await expect(tiles(page)).toHaveText('None');
	await newFolder(page, 'Teensy');
	await expect(crumbs(page)).toHaveText(/Club night\s*\/\s*Teensy/);
	await crumbs(page).getByRole('button', { name: 'Scripts' }).tap();
	await expect(tile(page, 'Club night')).toContainText('1 item');
	await noSidewaysScroll(page);

	// A script goes in any folder from its own dialog.
	await tile(page, 'Storm Front').tap();
	const script = page.getByRole('dialog', { name: 'Storm Front' });
	await script.getByRole('combobox', { name: 'Folder' }).tap();
	await page.getByRole('option', { name: 'Club night / Teensy', exact: true }).tap();
	await script.getByRole('button', { name: 'Close' }).tap();
	await expect(tile(page, 'Storm Front')).toHaveCount(0);
	await tile(page, 'Club night').tap();
	await tile(page, 'Teensy').tap();
	await expect(tile(page, 'Storm Front')).toBeVisible();

	// Search finds scripts in every folder and says where each one is.
	await crumbs(page).getByRole('button', { name: 'Scripts' }).tap();
	await page.getByPlaceholder('Name, author or character').fill('washerwoman');
	await expect(tile(page, 'Storm Front')).toContainText('Club night / Teensy');
	await page.getByRole('button', { name: 'Clear' }).first().tap();

	// Kept on the device.
	await page.reload();
	await tile(page, 'Club night').tap();
	await tile(page, 'Teensy').tap();

	// Rename, then move the open folder to the top level.
	await page.getByRole('button', { name: 'Rename Teensy' }).tap();
	const rename = page.getByRole('dialog', { name: 'Rename' });
	await rename.getByRole('textbox', { name: 'Name' }).fill('Small games');
	await rename.getByRole('button', { name: 'Save' }).tap();
	await page.getByRole('button', { name: 'Move Small games' }).tap();
	const move = page.getByRole('dialog', { name: 'Move Small games' });
	await move.getByRole('combobox', { name: 'Move to' }).tap();
	await expect(page.getByRole('option', { name: 'Club night / Small games' })).toHaveCount(0);
	await page.getByRole('option', { name: 'Scripts', exact: true }).tap();
	await move.getByRole('button', { name: 'Move', exact: true }).tap();
	await expect(crumbs(page)).toHaveText(/Scripts\s*\/\s*Small games$/);

	// Deleting a folder asks, and what it held moves up a level.
	await page.getByRole('button', { name: 'Delete Small games' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete folder?' });
	await expect(confirm).toContainText('Its scripts and folders move to Scripts.');
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(crumbs(page)).toHaveText('Scripts');
	await expect(tile(page, 'Storm Front')).toBeVisible();
	await expect(tile(page, 'Club night')).toContainText('0 items');
});

test('the table view keeps tags, filters and removing', async ({ page }) => {
	await page.goto('/library');
	await (await addStormFront(page)).getByRole('button', { name: 'Close' }).tap();
	await newFolder(page, 'Club night');
	await page.getByRole('radiogroup', { name: 'View' }).getByText('Table', { exact: true }).tap();
	await expect(row(page)).toBeVisible();
	await noSidewaysScroll(page);

	// Tags are the user's own.
	await page.getByRole('button', { name: 'Tags', exact: true }).first().tap();
	const manage = page.getByRole('dialog', { name: 'Tags' });
	await manage.getByPlaceholder('New tag').fill('Stupid fun');
	await manage.getByRole('button', { name: 'Add' }).tap();
	await manage.getByPlaceholder('New tag').fill('stupid FUN');
	await expect(manage.getByText('That name is already used.')).toBeVisible();
	await manage.getByPlaceholder('New tag').fill('Wanna try');
	await manage.getByPlaceholder('New tag').press('Enter');
	await expect(manage.getByRole('listitem')).toHaveText(['Stupid fun', 'Wanna try']);
	await manage.getByRole('button', { name: 'Close' }).tap();

	// A script sits in one folder and carries any tags.
	await row(page).tap();
	const script = page.getByRole('dialog', { name: 'Storm Front' });
	await script.getByRole('combobox', { name: 'Folder' }).tap();
	await page.getByRole('option', { name: 'Club night' }).tap();
	const fun = script.getByRole('button', { name: 'Stupid fun' });
	await fun.tap();
	await expect(fun).toHaveAttribute('aria-pressed', 'true');
	// Only scripts made in the Script builder open there to edit.
	await expect(script.getByRole('button', { name: 'Edit in Script builder' })).toHaveCount(0);
	await expect(script.getByTestId('script-sheet')).toContainText('Washerwoman');
	await script.getByRole('button', { name: 'Close' }).tap();
	await expect(table(page)).toContainText('Club night');
	await expect(table(page)).toContainText('Stupid fun');

	// The chosen view is remembered.
	await page.reload();
	await expect(table(page)).toContainText('Club night');
	await expect(table(page)).toContainText('Stupid fun');

	// Filtering by a tag the script lacks leaves nothing; by its own, the script.
	await page
		.getByRole('button', { name: /^Filter (Tags|Name)/ })
		.first()
		.tap();
	await page.getByRole('checkbox', { name: 'Wanna try' }).check();
	await expect(row(page)).toHaveCount(0);
	await page.getByRole('checkbox', { name: 'Wanna try' }).uncheck();
	await page.getByRole('checkbox', { name: 'Stupid fun' }).check();
	await expect(row(page)).toBeVisible();
	await page.keyboard.press('Escape');

	// Deleting a tag asks, then takes it off the script, which stays.
	await page.getByRole('button', { name: 'Tags', exact: true }).first().tap();
	await manage.getByRole('button', { name: 'Delete Stupid fun' }).tap();
	const confirmTag = page.getByRole('alertdialog', { name: 'Delete tag?' });
	await expect(confirmTag).toContainText('taken off 1 script');
	await confirmTag.getByRole('button', { name: 'Confirm' }).tap();
	await manage.getByRole('button', { name: 'Close' }).tap();
	await expect(row(page)).toBeVisible();
	await expect(table(page)).not.toContainText('Stupid fun');

	// Removing a script asks first.
	await row(page).tap();
	await script.getByRole('button', { name: 'Remove script' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Remove script?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(row(page)).toHaveCount(0);
	await expect(table(page)).toContainText('None');
});

test('a script added inside an open folder goes in that folder', async ({ page }) => {
	await page.goto('/library');
	await newFolder(page, 'Club night');
	await (await addStormFront(page)).getByRole('button', { name: 'Close' }).tap();
	await expect(tile(page, 'Storm Front')).toBeVisible();
	await crumbs(page).getByRole('button', { name: 'Scripts' }).tap();
	await expect(tile(page, 'Storm Front')).toHaveCount(0);
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

test('the Library lists only the user’s own info tokens', async ({ page }) => {
	await page.goto('/library');
	const section = page.getByRole('region', { name: 'Info tokens' });
	await expect(section.getByRole('heading', { name: 'Custom' })).toBeVisible();
	await expect(section.getByRole('heading', { name: 'Standard' })).toHaveCount(0);
	await section.getByRole('button', { name: 'New info token' }).tap();
	await expect(page.getByRole('dialog')).toBeVisible();
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
	await tile(page, 'Built here').tap();
	await page
		.getByRole('dialog', { name: 'Built here' })
		.getByRole('button', { name: 'Edit in Script builder' })
		.tap();
	await expect(page).toHaveURL(/\/build-script$/);
	await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Built here');
	await expect(page.getByTestId('count-demon')).toHaveText('1');
});
