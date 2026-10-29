import { expect, test, type Locator, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';
import { openSettingsDialog } from './shell.ts';

// Settings profiles (plan S18, Trevor 2026-10-23): named sets of settings, made in Settings,
// picked in a new game's Game settings and switched from the board's Board sheet; each game remembers its own.

async function openSection(page: Page, section: string) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: section })
		.tap();
	await expect(dialog.getByRole('heading', { name: section, level: 2 })).toBeVisible();
	return dialog;
}

async function pickProfile(scope: Locator | Page, page: Page, name: string) {
	await scope.getByRole('combobox', { name: 'Settings profile' }).tap();
	await page.getByRole('option', { name }).tap();
	await expect(page.getByRole('listbox')).toBeHidden();
}

/** How the board shows a used ghost vote, as saved on the device. */
const ghostVote = (page: Page) =>
	page.evaluate(() => JSON.parse(localStorage.getItem('grim.boardLooks') ?? '{}').usedGhostVote);

async function startGame(page: Page, profile?: string) {
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	// Chosen in Character selection's Game settings (Trevor, 2026-10-29), no longer New game.
	if (profile) {
		await page.getByTestId('game-options').getByRole('button', { name: 'Game settings' }).tap();
		const dialog = page.getByRole('dialog', { name: 'Game settings' });
		await pickProfile(dialog, page, profile);
		await dialog.getByRole('button', { name: 'Close' }).tap();
	}
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	return page.url();
}

test('profiles are made in Settings, chosen for a new game and switched on the board', async ({
	page
}) => {
	await page.goto('/');
	const settings = await openSection(page, 'Profiles');
	const rows = settings.getByTestId('profile-row');
	// The settings in use become the first profile; the last one can't be deleted.
	await expect(rows).toHaveCount(1);
	await expect(rows.getByRole('textbox')).toHaveValue('My settings');
	await expect(rows.getByRole('button', { name: 'Delete My settings' })).toBeDisabled();

	await settings.getByRole('button', { name: 'New profile' }).tap();
	await expect(rows).toHaveCount(2);
	await rows.nth(1).getByRole('textbox').fill('Streaming');
	await pickProfile(settings, page, 'Streaming');

	// A change goes into the profile in use, named in the section's heading.
	// Phones show one section at a time: back to the list first.
	const back = settings.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) await back.tap();
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board', exact: true })
		.tap();
	await expect(settings.getByRole('combobox', { name: 'Settings profile' })).toHaveText(
		/Streaming/
	);
	await settings.getByText('Strike through used ghost votes', { exact: true }).tap();
	await expect.poll(() => ghostVote(page)).toBe('struck');
	await settings.getByRole('button', { name: 'Close' }).tap();

	// New game starts with the default profile, My settings.
	const first = await startGame(page);
	await expect.poll(() => ghostVote(page)).toBe('hollow');

	// Switched from the board's Board sheet: that game now uses Streaming.
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Settings', exact: true })
		.tap();
	const sheet = page.getByRole('dialog', { name: 'Settings' });
	// It opens at its root (Trevor, 2026-10-27).
	await sheet
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board', exact: true })
		.tap();
	await pickProfile(sheet, page, 'Streaming');
	await expect.poll(() => ghostVote(page)).toBe('struck');
	await sheet.getByRole('button', { name: 'Close' }).tap();

	// Another game with My settings, then back to the first: it remembers Streaming.
	await startGame(page, 'My settings');
	await expect.poll(() => ghostVote(page)).toBe('hollow');
	await page.goto(first);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await expect.poll(() => ghostVote(page)).toBe('struck');
});

test('each profile shows what tells it apart', async ({ page }) => {
	// Trevor (2026-10-25): players need more in a profile to choose which one to use.
	await page.goto('/');
	const settings = await openSection(page, 'Profiles');
	const row = settings.getByTestId('profile-row');
	await expect(row.getByTestId('profile-looks')).toHaveText(
		'No background · Text 100% · 0 changes'
	);
	await expect(row.getByTestId('profile-games')).toHaveText('No saved games');
	await settings.getByRole('button', { name: 'Close' }).tap();

	await startGame(page);
	await page.goto('/');
	// The same dialog opens again, so the row's locator still finds it.
	await openSection(page, 'Profiles');
	await expect(row.getByTestId('profile-games')).toHaveText(/^1 saved game, last /);
});
