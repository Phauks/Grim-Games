import { expect, test, type Page } from '@playwright/test';
import { openSettingsDialog, theMenu } from './shell.ts';
import { openTheme } from './theme.ts';

// Laurels round seat tokens (L4, A1): each player's own pick in their Profile. The fixed
// frames are laurel forms, and the Storyteller's Board default is gone (Trevor, 2026-10-27).

/**
 * Opens the Profile from the button beside Settings' X (Trevor, 2026-10-27): its own dialog,
 * in Settings' place (2026-11-15).
 */
async function openProfile(page: Page) {
	const settings = await openSettingsDialog(page);
	await settings.getByRole('button', { name: 'Profile', exact: true }).tap();
	await expect(settings).toBeHidden();
	const dialog = page.getByRole('dialog', { name: 'Profile', exact: true });
	await expect(dialog).toBeVisible();
	return dialog;
}

/**
 * Picks the character that represents the player, as a detail (Trevor, 2026-11-16: "remove
 * character token, integrate any functionality in profile with add detail").
 */
async function pickCharacterToken(page: Page, character: string) {
	const profile = page.getByRole('dialog', { name: 'Profile', exact: true });
	await profile.getByTestId('profile-detail-new').tap();
	const form = page.getByRole('dialog', { name: 'New detail' });
	await form.getByRole('combobox', { name: 'Detail' }).tap();
	await page.getByRole('option', { name: 'Character token', exact: true }).tap();
	await form.getByRole('button', { name: 'Pick character' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character token' });
	await picker.getByRole('searchbox').fill(character);
	await picker
		.getByRole('button', { name: new RegExp(character) })
		.first()
		.tap();
	await expect(picker).toBeHidden();
	await form.getByRole('button', { name: 'Save' }).tap();
	await expect(form).toBeHidden();
}

/** Opens a drop-down and taps one choice, as a finger would. */
async function pick(page: Page, label: string, option: string) {
	await page.getByRole('combobox', { name: label }).tap();
	await page.getByRole('option', { name: option, exact: true }).tap();
	await expect(page.getByRole('listbox')).toBeHidden();
}

/** One of the Profile's folding groups of tiles: Your laurel, Color or Motion. */
function tiles(page: Page, group: string) {
	return page
		.getByRole('dialog', { name: 'Profile', exact: true })
		.getByRole('group', { name: group, exact: true });
}

/** Opens a folding group if it is closed and taps one of its tiles (Trevor, 2026-11-15). */
async function choose(page: Page, group: string, option: string) {
	const dialog = page.getByRole('dialog', { name: 'Profile', exact: true });
	const head = dialog.getByRole('button', { name: group, exact: true });
	if ((await head.getAttribute('aria-expanded')) !== 'true') await head.tap();
	const tile = tiles(page, group).getByRole('button', { name: option, exact: true });
	await tile.tap();
	await expect(tile).toHaveAttribute('aria-pressed', 'true');
}

test('the Profile is its own dialog: from the menu, with the seat pinned while it scrolls', async ({
	page
}) => {
	// Trevor, 2026-11-15 (option E): a dedicated Profile dialog, the seat pinned, every laurel,
	// colour and motion shown at once in groups that fold. The menu has a Profile button.
	await page.goto('/');
	const nav = await theMenu(page);
	await nav.getByRole('button', { name: 'Profile', exact: true }).tap();
	const dialog = page.getByRole('dialog', { name: 'Profile', exact: true });
	await expect(dialog).toBeVisible();
	const preview = dialog.getByTestId('profile-preview');
	await choose(page, 'Your laurel', 'Olive');
	await dialog.getByRole('button', { name: 'Motion', exact: true }).tap();
	// Scrolling the choices to the end leaves the seat in view, held at the dialog's top.
	const add = dialog.getByTestId('profile-detail-new');
	await add.scrollIntoViewIfNeeded();
	await expect(add).toBeInViewport();
	await expect(preview).toBeInViewport();
	const top = (await dialog.boundingBox())!.y;
	expect((await preview.boundingBox())!.y).toBeGreaterThanOrEqual(top);
});

test("the Board has no frame of its own: laurels are each player's", async ({ page }) => {
	const dialog = await openTheme(page, 'Board');
	await expect(dialog.getByRole('combobox', { name: 'Seat frame' })).toHaveCount(0);
});

test('the Profile warns that the look on a seat must never hint at a character', async ({
	page
}) => {
	// Plan R14 (Trevor, 2026-10-29): a fair-play warning, not a lock during the game. Behind an
	// info button, so it isn't so loud (Trevor, 2026-11-16).
	await page.goto('/');
	const dialog = await openProfile(page);
	const info = dialog.getByRole('button', { name: 'Fair play' });
	await expect(info).toBeVisible();
	await expect(dialog.getByText('Never change it during a game')).toHaveCount(0);
	await info.tap();
	await expect(page.getByTestId('fair-play-full')).toContainText(
		'Never change it during a game to hint at a character'
	);
});

test('a player picks a laurel form, its colour and its motion, and keeps them', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	const preview = dialog.getByTestId('profile-preview');
	const heads = dialog.getByTestId('player-frame-setting');
	// Each group folds, closed at first, its pick at the end of its header (Trevor, 2026-11-15).
	await expect(dialog.getByRole('button', { name: 'Your laurel', exact: true })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await expect(heads).toContainText('None');
	await dialog.getByRole('button', { name: 'Color', exact: true }).tap();
	await dialog.getByRole('button', { name: 'Motion', exact: true }).tap();
	// The colour and motion tiles are always there; None disables them.
	await expect(tiles(page, 'Color').getByRole('button', { name: 'Orange' })).toBeDisabled();
	await expect(tiles(page, 'Motion').getByRole('button', { name: 'Pulse' })).toBeDisabled();

	// Every form is a tile drawn round the player's own face.
	await choose(page, 'Your laurel', 'Simple ring');
	await expect(
		tiles(page, 'Your laurel')
			.getByRole('button', { name: 'Olive' })
			.locator('[data-testid="avatar-face"]')
	).toBeAttached();
	await expect(preview.locator('svg[data-frame="ring-accent"]')).toBeAttached();
	await expect(tiles(page, 'Color').getByRole('button', { name: 'Orange' })).toBeEnabled();
	// Any form takes any colour, the simple ring too (Trevor, 2026-10-28).
	await choose(page, 'Color', 'Orange');
	await expect(preview.locator('svg[data-frame="ring-minion"]')).toBeAttached();

	// A new form keeps the colour.
	await choose(page, 'Your laurel', 'Olive');
	await expect(preview.locator('svg[data-frame="laurel-olive-minion"]')).toBeAttached();
	await choose(page, 'Color', 'Red');
	// The colour shows as itself, not drawn as a laurel (Trevor, 2026-10-28).
	await expect(tiles(page, 'Color').locator('.dot').first()).toBeAttached();
	await expect(tiles(page, 'Color').locator('svg[data-frame]')).toHaveCount(0);
	await choose(page, 'Motion', 'Clockwise shimmer');
	await expect(preview.locator('svg[data-frame="laurel-olive-demon~shimmer-cw"]')).toBeAttached();
	await expect(preview.locator('[data-shimmer]')).toBeAttached();

	await page.reload();
	const again = await openProfile(page);
	await expect(again.getByTestId('player-frame-setting')).toContainText('Olive');
	await expect(again.getByTestId('player-frame-setting')).toContainText('Red');
	await expect(again.getByTestId('player-frame-setting')).toContainText('Clockwise shimmer');
	await expect(
		again.getByTestId('profile-preview').locator('svg[data-frame="laurel-olive-demon~shimmer-cw"]')
	).toBeAttached();
});

test('every motion can be picked and keeps the laurel (Trevor, 2026-10-28)', async ({ page }) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	await choose(page, 'Your laurel', 'Olive');
	const preview = dialog.getByTestId('profile-preview');
	for (const [name, id] of [
		['Pulse', 'pulse'],
		['Breathe', 'breathe'],
		['Twinkle', 'twinkle'],
		['Regrow', 'regrow'],
		['Flicker', 'flicker']
	]) {
		await choose(page, 'Motion', name);
		await expect(preview.locator(`svg[data-frame="laurel-olive-gold~${id}"]`)).toBeAttached();
	}
	await choose(page, 'Motion', 'Twinkle');
	await expect(preview.locator('.sparkle')).toHaveCount(6);
});

test('tapping the seat in the Profile shows the profile as others see it, over the Profile', async ({
	page
}) => {
	// Trevor, 2026-11-16: "pressing the profile in profile should showcase what it looks like to
	// other people".
	await page.goto('/');
	const dialog = await openProfile(page);
	await choose(page, 'Your laurel', 'Olive');
	await dialog.getByRole('button', { name: 'Edit your name' }).tap();
	const modal = page.getByRole('dialog', { name: 'Your name' });
	await modal.getByRole('textbox', { name: 'Your name' }).fill('Pixelation');
	await modal.getByRole('button', { name: 'Save' }).tap();
	const small = await dialog.getByTestId('profile-preview').boundingBox();
	await dialog.getByRole('button', { name: 'See your profile as others do' }).tap();
	const shown = page.getByTestId('player-profile');
	await expect(shown).toBeVisible();
	await expect(shown.locator('svg[data-frame^="laurel-olive"]')).toBeAttached();
	const others = page.getByRole('dialog', { name: 'Pixelation' });
	await expect(others).toBeVisible();
	// Over the Profile: the Profile underneath has not moved.
	await others.getByRole('button', { name: 'Close' }).first().tap();
	await expect(others).toBeHidden();
	expect(await dialog.getByTestId('profile-preview').boundingBox()).toEqual(small);
});

test('the Profile sets the player name with no room, kept for the next one', async ({ page }) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	await dialog.getByRole('button', { name: 'Edit your name' }).tap();
	const modal = page.getByRole('dialog', { name: 'Your name' });
	await modal.getByRole('textbox', { name: 'Your name' }).fill('Robin');
	await modal.getByRole('button', { name: 'Save' }).tap();
	await expect(modal).toBeHidden();
	await expect(dialog.getByTestId('profile-preview')).toContainText('Robin');

	await page.reload();
	const again = await openProfile(page);
	await expect(again.getByTestId('profile-preview')).toContainText('Robin');
});

test('the Profile keeps a tag-line, edited in its own modal (Trevor, 2026-10-28, 2026-11-01)', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	await expect(dialog.getByTestId('flavour-text')).toHaveText('None');
	await dialog.getByRole('button', { name: 'Edit tag-line' }).tap();
	const modal = page.getByRole('dialog', { name: 'Tag-line' });
	await modal.getByRole('textbox', { name: 'Tag-line' }).fill('Always the Drunk.');
	await modal.getByRole('button', { name: 'Save' }).tap();
	await expect(modal).toBeHidden();
	await expect(dialog.getByTestId('flavour-text')).toHaveText('Always the Drunk.');

	await page.reload();
	const again = await openProfile(page);
	await expect(again.getByTestId('flavour-text')).toHaveText('Always the Drunk.');
});

test('the Profile takes optional details, from suggestions or written out (Trevor, 2026-11-01)', async ({
	page
}) => {
	// "Let's add some custom text people can add per profile ... 'Favorite Script', 'Favorite
	// Character Type' ... give people the opportunity to spruce up their profile, but also don't
	// require it".
	await page.goto('/');
	const dialog = await openProfile(page);
	await expect(dialog.getByTestId('profile-detail-text')).toHaveCount(0);
	const add = dialog.getByTestId('profile-detail-new');
	const box = (await add.boundingBox())!;
	expect(box.height).toBeGreaterThanOrEqual(43.5);

	// A suggestion fills in the label; the player writes the text.
	await add.tap();
	const modal = page.getByRole('dialog', { name: 'New detail' });
	await expect(modal.getByRole('textbox', { name: 'Label' })).toBeDisabled();
	await expect(modal.getByRole('button', { name: 'Save' })).toBeDisabled();
	await modal.getByRole('textbox', { name: 'Text' }).fill('Trouble Brewing');
	await modal.getByRole('button', { name: 'Save' }).tap();
	await expect(modal).toBeHidden();

	// Custom takes their own label.
	await add.tap();
	await pick(page, 'Detail', 'Custom');
	await modal.getByRole('textbox', { name: 'Label' }).fill('Lucky dice');
	await modal.getByRole('textbox', { name: 'Text' }).fill('The blue d20');
	await modal.getByRole('button', { name: 'Save' }).tap();
	await expect(modal).toBeHidden();
	await expect(dialog.getByTestId('profile-detail-text')).toHaveText([
		'Trouble Brewing',
		'The blue d20'
	]);

	// Edited with the pencil, and deleted from the same dialog; kept after a reload.
	await dialog.getByRole('button', { name: 'Edit Favorite script' }).tap();
	const edit = page.getByRole('dialog', { name: 'Edit detail' });
	await edit.getByRole('textbox', { name: 'Text' }).fill('Bad Moon Rising');
	await edit.getByRole('button', { name: 'Save' }).tap();
	await expect(edit).toBeHidden();
	await dialog.getByRole('button', { name: 'Edit Lucky dice' }).tap();
	await edit.getByRole('button', { name: 'Delete detail' }).tap();
	await expect(edit).toBeHidden();

	await page.reload();
	const again = await openProfile(page);
	await expect(again.getByTestId('profile-detail-text')).toHaveText(['Bad Moon Rising']);
});

test('a representative character stays in the Profile, off every seat (Trevor, 2026-11-03)', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	await choose(page, 'Your laurel', 'Olive');
	await expect(dialog.getByTestId('character-icon')).toHaveCount(0);
	await pickCharacterToken(page, 'Fortune Teller');
	await expect(dialog.getByTestId('character-icon')).toContainText('Fortune Teller');

	// Laurels and avatars are enough: the seat and the Profile button keep the initials and
	// show no character over them.
	const preview = dialog.getByTestId('profile-preview');
	await expect(preview.getByTestId('avatar-face').locator('svg')).toBeAttached();
	await expect(preview.locator('img')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).first().tap();
	const settings = await openSettingsDialog(page);
	await expect(settings.getByTestId('profile-button').locator('img')).toHaveCount(0);
	await page.keyboard.press('Escape');

	await page.reload();
	const again = await openProfile(page);
	await expect(again.getByTestId('character-icon')).toContainText('Fortune Teller');
	// Deleting the detail leaves the initials alone again.
	await again.getByRole('button', { name: 'Change character token' }).tap();
	await page
		.getByRole('dialog', { name: 'Edit detail' })
		.getByRole('button', { name: 'Delete detail' })
		.tap();
	await expect(again.getByTestId('character-icon')).toHaveCount(0);
});

test('the Profile seat keeps clear of the text under it, laurel and name (Trevor, 2026-11-03)', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	// What sits under the seat: History's counts beside a wide screen's choices, else the
	// choices themselves.
	const stats = dialog.getByTestId('profile-stats');
	const notice = (await stats.count()) ? stats : dialog.getByTestId('player-frame-setting');
	const preview = dialog.getByTestId('profile-preview');
	// The text's place under the seat; the dialog may scroll while picking.
	const gap = async () => (await notice.boundingBox())!.y - (await preview.boundingBox())!.y;
	const before = await gap();

	await dialog.getByRole('button', { name: 'Edit your name' }).tap();
	const modal = page.getByRole('dialog', { name: 'Your name' });
	await modal.getByRole('textbox', { name: 'Your name' }).fill('Pixelation');
	await modal.getByRole('button', { name: 'Save' }).tap();
	await choose(page, 'Your laurel', 'Olive');
	await choose(page, 'Motion', 'Pulse');
	await pickCharacterToken(page, 'Fortune Teller');

	// Picking them moved nothing, seen from the dialog's top (the seat stays pinned while the
	// choices under it scroll).
	await dialog.evaluate((element) => (element.scrollTop = 0));
	expect(await gap()).toBe(before);
	await preview.scrollIntoViewIfNeeded();
	const textTop = (await notice.boundingBox())!.y;
	// The laurel at the height of its pulse and the name end above the text, and the laurel
	// stays inside the seat's own room.
	const frame = (await preview.locator('svg[data-frame]').boundingBox())!;
	const name = (await preview.getByTestId('token-player-name').locator('rect').boundingBox())!;
	const box = (await preview.boundingBox())!;
	expect(frame.y + frame.height).toBeLessThanOrEqual(textTop);
	expect(name.y + name.height).toBeLessThanOrEqual(textTop);
	expect(box.y + box.height).toBeLessThanOrEqual(textTop);
	expect(frame.x).toBeGreaterThanOrEqual(box.x);
});

test('no frame or motion paints over the face', async ({ page }) => {
	test.slow(); // many screenshots, each compared whole
	// Trevor, 2026-11-16: "Laurel motion seems to have issues where it overwrites the image";
	// Scalloped's fill was a plate over the whole face, and the shimmer's light was a layer
	// cut to the frame by a CSS mask, which a moving layer may slip.
	await page.goto('/');
	const dialog = await openProfile(page);
	const face = dialog.getByTestId('profile-preview').locator('[data-token-face]');
	const inner = async () => {
		const box = (await face.boundingBox())!;
		const clip = {
			x: box.x + box.width * 0.2,
			y: box.y + box.height * 0.2,
			width: box.width * 0.6,
			height: box.height * 0.6
		};
		return page.screenshot({ clip, animations: 'allow' });
	};
	// The face with no frame, once the dialog has finished opening.
	await choose(page, 'Your laurel', 'None');
	await expect(async () => expect(await inner()).toEqual(await inner())).toPass();
	const bare = await inner();
	for (const form of ['Scalloped', 'Laurel']) {
		await choose(page, 'Your laurel', form);
		for (const motion of ['None', 'Shimmer', 'Clockwise shimmer']) {
			await choose(page, 'Motion', motion);
			// Twice, the light elsewhere on the ring each time.
			for (let i = 0; i < 2; i++) {
				expect(await inner(), `${form}, ${motion}`).toEqual(bare);
				await page.waitForTimeout(700);
			}
		}
	}
});

test("the Profile's seat changes laurel without the arrival grow-in", async ({ page }) => {
	// Trevor, 2026-11-16: "in the profile area, when making changes, don't show the i have
	// arrived animation, as that isn't useful in this context". Seats on a board still grow
	// a laurel in as a player arrives (e2e/room.e2e.ts).
	await page.goto('/');
	const dialog = await openProfile(page);
	await page.evaluate(() => {
		(window as unknown as { grew: boolean }).grew = false;
		new MutationObserver(() => {
			if (document.querySelector('[data-testid="profile-preview"] [data-growing]')) {
				(window as unknown as { grew: boolean }).grew = true;
			}
		}).observe(document.body, { subtree: true, childList: true, attributes: true });
	});
	for (const form of ['Laurel', 'Olive', 'None', 'Simple ring']) {
		await choose(page, 'Your laurel', form);
	}
	await choose(page, 'Motion', 'Pulse');
	await expect(dialog.getByTestId('profile-preview').locator('svg[data-frame]')).toBeAttached();
	expect(await page.evaluate(() => (window as unknown as { grew: boolean }).grew)).toBe(false);
});
