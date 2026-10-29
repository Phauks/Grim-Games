import { expect, test, type Page } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

// Laurels round seat tokens (L4, A1): each player's own pick in their Profile. The fixed
// frames are laurel forms, and the Storyteller's Board default is gone (Trevor, 2026-10-27).

async function openSettings(page: Page, section: string) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: section })
		.tap();
	await expect(dialog.getByRole('heading', { name: section, level: 2 })).toBeVisible();
	return dialog;
}

/** Opens the Profile from the button beside Settings' X (Trevor, 2026-10-27). */
async function openProfile(page: Page) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog.getByRole('button', { name: 'Profile', exact: true }).tap();
	await expect(dialog.getByRole('heading', { name: 'Profile', level: 2 })).toBeVisible();
	return dialog;
}

/** Opens a drop-down and taps one choice, as a finger would. */
async function pick(page: Page, label: string, option: string) {
	await page.getByRole('combobox', { name: label }).tap();
	await page.getByRole('option', { name: option, exact: true }).tap();
	await expect(page.getByRole('listbox')).toBeHidden();
}

test("the Board has no frame of its own: laurels are each player's", async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Board');
	await expect(dialog.getByRole('combobox', { name: 'Seat frame' })).toHaveCount(0);
	await expect(dialog.getByTestId('board-preview').locator('svg[data-frame]')).toHaveCount(0);
});

test('a player picks a laurel form, its colour and its motion, and keeps them', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	const form = dialog.getByRole('combobox', { name: 'Your laurel' });
	const colour = dialog.getByRole('combobox', { name: 'Color', exact: true });
	const motion = dialog.getByRole('combobox', { name: 'Motion' });
	await expect(form).toContainText('None');
	// The colour and motion rows are always there, so picking a form moves nothing; None
	// disables them.
	await expect(colour).toBeDisabled();
	await expect(motion).toBeDisabled();
	// Measured from the laurel's row: the pick may scroll the Profile on a short screen.
	const gap = async () => (await motion.boundingBox())!.y - (await form.boundingBox())!.y;
	const below = await gap();

	// Any form takes any colour, the simple ring too (Trevor, 2026-10-28).
	await pick(page, 'Your laurel', 'Simple ring');
	await expect(form.locator('svg[data-frame="ring-accent"]')).toBeAttached();
	await expect(colour).toBeEnabled();
	expect(await gap()).toBe(below);
	await pick(page, 'Color', 'Orange');
	await expect(form.locator('svg[data-frame="ring-minion"]')).toBeAttached();

	// A new form keeps the colour.
	await pick(page, 'Your laurel', 'Olive');
	await expect(form.locator('svg[data-frame="laurel-olive-minion"]')).toBeAttached();
	await pick(page, 'Color', 'Red');
	// The colour shows as itself, not drawn as a laurel (Trevor, 2026-10-28).
	await expect(colour.locator('.dot')).toBeAttached();
	await expect(colour.locator('svg[data-frame]')).toHaveCount(0);
	await pick(page, 'Motion', 'Clockwise shimmer');
	const preview = dialog.getByTestId('profile-preview');
	await expect(preview.locator('svg[data-frame="laurel-olive-demon~shimmer-cw"]')).toBeAttached();
	await expect(preview.locator('[data-shimmer]')).toBeAttached();

	await page.reload();
	const again = await openProfile(page);
	await expect(
		again
			.getByRole('combobox', { name: 'Your laurel' })
			.locator('svg[data-frame="laurel-olive-demon~shimmer-cw"]')
	).toBeAttached();
	await expect(again.getByRole('combobox', { name: 'Color', exact: true })).toContainText('Red');
	await expect(again.getByRole('combobox', { name: 'Motion' })).toContainText('Clockwise shimmer');
});

test('every motion can be picked and keeps the laurel (Trevor, 2026-10-28)', async ({ page }) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	await pick(page, 'Your laurel', 'Olive');
	const preview = dialog.getByTestId('profile-preview');
	for (const [name, id] of [
		['Pulse', 'pulse'],
		['Breathe', 'breathe'],
		['Twinkle', 'twinkle'],
		['Regrow', 'regrow'],
		['Flicker', 'flicker']
	]) {
		await pick(page, 'Motion', name);
		await expect(preview.locator(`svg[data-frame="laurel-olive-gold~${id}"]`)).toBeAttached();
	}
	await pick(page, 'Motion', 'Twinkle');
	await expect(preview.locator('.sparkle')).toHaveCount(6);
});

test('tapping the seat in the Profile shows it large, over the Profile', async ({ page }) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	const small = await dialog.getByTestId('profile-preview').boundingBox();
	await dialog.getByTestId('profile-preview').tap();
	const big = page.getByRole('dialog', { name: 'Preview', exact: true });
	await expect(big).toBeVisible();
	const disc = big.getByTestId('profile-big-preview').locator('.seat-disc');
	await expect(disc).toBeVisible();
	expect((await disc.boundingBox())?.width ?? 0).toBeGreaterThan((small?.width ?? 0) * 1.5);
	// Over the Profile: the Profile underneath has not moved.
	await big.getByRole('button', { name: 'Close' }).tap();
	await expect(big).toBeHidden();
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

test('the Profile keeps a flavour text, edited in its own modal (Trevor, 2026-10-28)', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	await expect(dialog.getByTestId('flavour-text')).toHaveText('None');
	await dialog.getByRole('button', { name: 'Edit flavour text' }).tap();
	const modal = page.getByRole('dialog', { name: 'Flavour text' });
	await modal.getByRole('textbox', { name: 'Flavour text' }).fill('Always the Drunk.');
	await modal.getByRole('button', { name: 'Save' }).tap();
	await expect(modal).toBeHidden();
	await expect(dialog.getByTestId('flavour-text')).toHaveText('Always the Drunk.');

	await page.reload();
	const again = await openProfile(page);
	await expect(again.getByTestId('flavour-text')).toHaveText('Always the Drunk.');
});

test('a representative character sits on top of the laurel, still while it moves (Trevor, 2026-10-28)', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openProfile(page);
	await pick(page, 'Your laurel', 'Olive');
	await pick(page, 'Motion', 'Rotate clockwise');
	await expect(dialog.getByTestId('character-icon')).toHaveText('None');
	await dialog.getByRole('button', { name: 'Change character token' }).tap();
	const picker = page.getByRole('dialog', { name: 'Character token' });
	await picker.getByRole('searchbox').fill('Fortune Teller');
	await picker
		.getByRole('button', { name: /Fortune Teller/ })
		.first()
		.tap();
	await expect(picker).toBeHidden();
	await expect(dialog.getByTestId('character-icon')).toContainText('Fortune Teller');

	const preview = dialog.getByTestId('profile-preview');
	const emblem = preview.getByTestId('character-emblem');
	await expect(emblem).toHaveAttribute('data-character', 'fortuneteller');
	// Full colour in the Profile; seats engrave it.
	await expect(emblem).not.toHaveAttribute('data-engraved');
	// The face keeps the initials, and the token is outside the turning laurel.
	await expect(preview.getByTestId('avatar-face').locator('svg')).toBeAttached();
	await expect(preview.locator('.frame-layer').getByTestId('character-emblem')).toHaveCount(0);
	// Above the laurel's middle: on its top.
	const disc = await preview.locator('.disc').boundingBox();
	const box = await emblem.boundingBox();
	expect(box!.y + box!.height / 2).toBeLessThan(disc!.y + disc!.height * 0.2);

	await page.reload();
	const again = await openProfile(page);
	await expect(again.getByTestId('character-icon')).toContainText('Fortune Teller');
	await again.getByRole('button', { name: 'Change character token' }).tap();
	await page
		.getByRole('dialog', { name: 'Character token' })
		.getByRole('button', { name: 'None' })
		.tap();
	await expect(again.getByTestId('character-icon')).toHaveText('None');
	await expect(again.getByTestId('profile-preview').getByTestId('character-emblem')).toHaveCount(0);
});
