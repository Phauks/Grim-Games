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

async function noSidewaysScroll(page: Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('saved scripts get folders and tags, filter by them, and can be removed', async ({ page }) => {
	await page.goto('/scripts');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(homebrew))
	});
	await expect(page.getByTestId('script-details-name')).toHaveText('Storm Front');

	await page.goto('/library');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Library');
	await expect(row(page)).toBeVisible();
	await noSidewaysScroll(page);

	// Folders and tags are the user's own.
	await page.getByRole('button', { name: 'Folders and tags' }).tap();
	const manage = page.getByRole('dialog', { name: 'Folders and tags' });
	await manage.getByPlaceholder('New folder').fill('Club night');
	await manage.getByPlaceholder('New folder').press('Enter');
	await manage.getByPlaceholder('New tag').fill('Stupid fun');
	await manage.getByRole('button', { name: 'Add' }).nth(1).tap();
	await manage.getByPlaceholder('New tag').fill('stupid FUN');
	await expect(manage.getByText('That name is already used.')).toBeVisible();
	await manage.getByPlaceholder('New tag').fill('Wanna try');
	await manage.getByPlaceholder('New tag').press('Enter');
	await expect(manage.getByRole('listitem')).toHaveText(['Club night', 'Stupid fun', 'Wanna try']);
	await manage.getByRole('button', { name: 'Close' }).tap();

	// A script sits in one folder and carries any tags.
	await row(page).tap();
	const script = page.getByRole('dialog', { name: 'Storm Front' });
	await script.getByRole('combobox', { name: 'Folder' }).tap();
	await page.getByRole('option', { name: 'Club night' }).tap();
	const fun = script.getByRole('button', { name: 'Stupid fun' });
	await fun.tap();
	await expect(fun).toHaveAttribute('aria-pressed', 'true');
	await expect(script.getByTestId('script-characters')).toContainText('Washerwoman');
	await script.getByRole('button', { name: 'Close' }).tap();
	await expect(table(page)).toContainText('Club night');
	await expect(table(page)).toContainText('Stupid fun');

	// Kept on the device.
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
	await page.getByRole('button', { name: 'Folders and tags' }).tap();
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

test('the Library lists only the user’s own info tokens', async ({ page }) => {
	await page.goto('/library');
	const section = page.getByRole('region', { name: 'Info tokens' });
	await expect(section.getByRole('heading', { name: 'Custom' })).toBeVisible();
	await expect(section.getByRole('heading', { name: 'Standard' })).toHaveCount(0);
	await section.getByRole('button', { name: 'New info token' }).tap();
	await expect(page.getByRole('dialog')).toBeVisible();
});
