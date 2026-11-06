import { expect, test } from '@playwright/test';

// Home (plan M69, Trevor 2026-11-06: option A, with the room code typed on Home itself).
test('Home starts a game, takes a room code and links the Prepare and Create pages', async ({
	page
}) => {
	await page.goto('/');
	const main = page.getByRole('main');

	// New game is a link; the daily puzzle's place is held, disabled, so nothing moves later.
	await expect(main.getByRole('link', { name: 'New game' })).toHaveAttribute('href', /\/new$/);
	await expect(main.getByRole('button', { name: 'Daily puzzle' })).toBeDisabled();

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
