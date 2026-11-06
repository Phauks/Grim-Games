import { expect, test } from '@playwright/test';

// Home (plan M69, Trevor 2026-11-06: option A, with the room code typed on Home itself).
test('Home starts a game, takes a room code and links the Prepare and Create pages', async ({
	page
}) => {
	await page.goto('/');
	const main = page.getByRole('main');

	// New game is a link, and no Daily puzzle button (Trevor, 2026-11-06).
	await expect(main.getByRole('link', { name: 'New game' })).toHaveAttribute('href', /\/new$/);
	await expect(main.getByRole('button', { name: 'Daily puzzle' })).toHaveCount(0);

	// Join game's own code form: a code is looked up before anyone joins, as on Join game.
	const join = main.getByRole('button', { name: 'Join as player' });
	await expect(join).toBeDisabled();
	await main.getByRole('textbox', { name: 'Room Code' }).fill('000 001');
	await expect(main.getByTestId('room-preview')).toHaveText('No open game has this code.');
	await expect(join).toBeDisabled();

	// Every place in the menu's Prepare and Create groups, each a big enough tap target.
	const places = main.getByTestId('home-places').getByRole('link');
	await expect(places).toHaveText([
		'Search',
		'Library',
		'Script builder',
		'Character builder',
		'Mode builder',
		'Info tokens',
		'Character Analyzer'
	]);
	for (const box of await Promise.all((await places.all()).map((l) => l.boundingBox()))) {
		expect(box!.height).toBeGreaterThanOrEqual(44);
	}
	await places.filter({ hasText: 'Library' }).tap();
	await expect(page).toHaveURL(/\/library$/);
});

test('Home leads with the last game, one tap back into it', async ({ page }) => {
	await page.goto('/');
	// No game yet: no row.
	await expect(page.getByRole('main').getByTestId('last-game')).toHaveCount(0);
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	const game = new URL(page.url()).pathname.replace(/\/setup$/, '');
	await page.goto('/');
	const last = page.getByRole('main').getByTestId('last-game');
	await expect(last).toHaveAccessibleName('Last game: Trouble Brewing');
	await last.tap();
	await expect(page).toHaveURL(new RegExp(game));
});

test('Home shows your Profile and History counts, and opens the Profile', async ({ page }) => {
	await page.goto('/');
	const card = page.getByRole('main').getByTestId('home-profile');
	await expect(card.getByTestId('profile-avatar')).toBeVisible();
	await expect(card.getByRole('definition')).toHaveText(['0', '0', '0']);
	await card.tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog.getByRole('heading', { name: 'Profile', level: 2 })).toBeVisible();
});
