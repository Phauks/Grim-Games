import { expect, test, type Locator, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { menuButton, openMenu, openSettingsDialog } from './shell.ts';
import { pickNumber } from './number-select.ts';
import { openTheme } from './theme.ts';

/** Opens settings from the menu and goes to a section (drill-in on phones). */
async function openSettings(page: Page, section: string) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeVisible();
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: section })
		.tap();
	await expect(dialog.getByRole('heading', { name: section, level: 2 })).toBeVisible();
	return dialog;
}

/** Taps the visible option card in a labelled radio group, as a finger would. */
const choose = (page: Page, group: string, option: string) =>
	page.getByRole('radiogroup', { name: group }).getByText(option, { exact: true }).tap();

/** Opens a font role's dropdown and taps one font, as a finger would. */
async function chooseFont(page: Page, role: string, font: RegExp) {
	await page.getByRole('combobox', { name: role }).tap();
	const option = page.getByRole('option', { name: font });
	const box = await option.boundingBox();
	// 44px tap target; allow sub-pixel rounding from the list's fixed positioning.
	expect(box?.height).toBeGreaterThanOrEqual(43.9);
	await option.tap();
	await expect(page.getByRole('listbox')).toBeHidden();
}

/** Sets a size slider, as a finished drag (input then change). */
async function slide(page: Page, name: string, value: number) {
	const slider = page.getByRole('slider', { name });
	await slider.fill(String(value));
	// The size applies on the next animation frame.
	await expect(slider).toHaveAttribute('aria-valuetext', `${Math.round(value * 100)}%`);
}

/** The reset icon beside a setting's name (named "Reset to default", described by the name). */
async function resetButton(scope: Locator, name: string) {
	const id = await scope
		.getByText(name, { exact: true })
		.and(scope.locator('[id]:not(h2)'))
		.getAttribute('id');
	return scope
		.getByRole('button', { name: 'Reset to default' })
		.and(scope.locator(`[aria-describedby="${id}"]`));
}

const rootStyle = (page: Page, name: string) =>
	page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n), name);

test('the grimoire theme is on every page, and the menu ends with Account and Settings', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'grimoire');
	expect(await rootStyle(page, '--font-heading')).toContain('Cinzel');
	// No app header (2026-10-22): the app's name heads the menu.
	await expect(page.getByRole('banner')).toHaveCount(0);
	const menu = await openMenu(page);
	await expect(menu.getByRole('heading', { name: APP_NAME })).toBeVisible();
	await expect(menu.getByRole('button', { name: 'Settings' })).toBeVisible();

	await menu.getByRole('link', { name: 'Account' }).tap();
	await expect(page).toHaveURL(/\/account$/);
});

test('/settings deep-links to the settings modal', async ({ page }) => {
	await page.goto('/settings');
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/$/);
});

test('a font chosen for one role from its dropdown applies to that role only and survives a reload', async ({
	page
}) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Text');
	const headingBefore = await rootStyle(page, '--font-heading');
	const trigger = dialog.getByRole('combobox', { name: 'Ability and rules text' });
	expect((await trigger.boundingBox())?.height).toBeGreaterThanOrEqual(44);
	await expect(trigger).toContainText('EB Garamond');

	await chooseFont(page, 'Ability and rules text', /^Lexend/);
	expect(await rootStyle(page, '--font-ability')).toContain('Lexend');
	expect(await rootStyle(page, '--font-heading')).toBe(headingBefore);
	expect(await rootStyle(page, '--font-body')).not.toContain('Lexend');
	// The closed dropdown shows the chosen font, drawn in that font.
	await expect(trigger).toContainText('Lexend');
	expect(
		await trigger.getByText('Lexend').evaluate((el) => getComputedStyle(el).fontFamily)
	).toContain('Lexend');
	await expect(dialog.locator('.line[data-role="ability"] dd.sample')).toHaveCSS(
		'font-family',
		/Lexend/
	);

	await page.reload();
	await expect.poll(() => rootStyle(page, '--font-ability')).toContain('Lexend');
	expect(await rootStyle(page, '--font-heading')).toBe(headingBefore);
	// Outside Settings only the chosen fonts are fetched (on demand).
	const faces = () =>
		page.evaluate(() => [...document.fonts].map((f) => `${f.family}:${f.status}`).join());
	// The chosen font's faces are registered (loaded once text uses them); others are not.
	await expect.poll(faces).toMatch(/Lexend/);
	expect(await faces()).not.toContain('IM Fell');

	const again = await openSettings(page, 'Text');
	await expect(again.getByRole('combobox', { name: 'Ability and rules text' })).toContainText(
		'Lexend'
	);
});

test('heading font, text size and icon weight apply live', async ({ page }) => {
	await page.goto('/spikes/icons');
	const dialog = await openSettings(page, 'Text');
	await chooseFont(page, 'Headings', /^IM Fell English SC/);
	expect(await rootStyle(page, '--font-heading')).toContain('IM Fell English SC');
	await expect(dialog.getByRole('heading', { name: 'Text', exact: true, level: 2 })).toHaveCSS(
		'font-family',
		/IM Fell English SC/
	);

	// Phones drill in, so go back to the section list first; tablets show the sidebar.
	const back = dialog.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) await back.tap();
	await dialog.getByRole('button', { name: 'Text', exact: true }).tap();
	await slide(page, 'Text size', 1.25);
	expect(await rootStyle(page, '--text-scale')).toBe('1.25');
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(
		'20px'
	);

	if (await back.isVisible()) await back.tap();
	await dialog.getByRole('button', { name: 'Icons' }).tap();
	await choose(page, 'Icon style', 'Fill');
	// The board's marks (Dead and the rest) are chosen in the game's Theme (Trevor, 2026-11-18).
	await expect(page.getByRole('radiogroup', { name: 'Dead' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close' }).tap();

	await expect(page.getByRole('img', { name: 'Night' })).toHaveAttribute(
		'data-icon',
		'ph:moon-stars-fill'
	);
});

test('Storyteller settings is a list of switches, saved on the device', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Storyteller');
	await expect(dialog.getByRole('radiogroup')).toHaveCount(0);
	const walkthrough = dialog.getByRole('checkbox', {
		name: 'Walk me through the night',
		includeHidden: true
	});
	await expect(walkthrough).toBeChecked();
	await dialog.getByText('Walk me through the night', { exact: true }).tap();
	await expect(walkthrough).not.toBeChecked();

	await page.reload();
	const again = await openSettings(page, 'Storyteller');
	await expect(
		again.getByRole('checkbox', { name: 'Walk me through the night', includeHidden: true })
	).not.toBeChecked();
	await expect(
		again.getByRole('checkbox', { name: 'Work out night answers', includeHidden: true })
	).toBeChecked();
});

// Trevor (2026-10-17): settings appear where they act; these are the same values as the
// board's own Background row. They left Settings for the game's Theme (Trevor, 2026-11-18).
test('the board looks and background are in Theme, saved for the board', async ({ page }) => {
	const theme = await openTheme(page, 'Background');
	const felt = theme.getByRole('button', { name: 'Felt', exact: true });
	await expect(felt).toHaveAttribute('aria-pressed', 'false');
	await felt.tap();
	await expect(felt).toHaveAttribute('aria-pressed', 'true');
	// None is the first background in the list, not a separate button (Trevor, 2026-10-18).
	const backgrounds = theme.getByRole('group', { name: 'Background for all games' });
	await expect(backgrounds.getByRole('button').first()).toHaveAccessibleName('None');
	await expect(theme.getByRole('button', { name: 'None', exact: true })).toHaveCount(1);
	// One band open at a time: Board closes Background.
	await theme.getByRole('button', { name: 'Board', exact: true }).tap();
	await expect(felt).toBeHidden();
	const vignette = theme.getByRole('checkbox', { name: 'Vignette', includeHidden: true });
	await expect(vignette).toBeChecked();
	await slide(page, 'Vignette strength', 0.3);
	await theme.getByText('Vignette', { exact: true }).tap();
	await expect(vignette).not.toBeChecked();
	// Shown but disabled while the vignette is off (Trevor, 2026-10-18).
	const strength = theme.getByRole('slider', { name: 'Vignette strength' });
	await expect(strength).toBeDisabled();
	await theme.getByText('Vignette', { exact: true }).tap();
	await expect(strength).toBeEnabled();
	await theme.getByText('Vignette', { exact: true }).tap();
	// The player name badge is set in Character tokens (Trevor, 2026-10-20).
	await expect(theme.getByRole('slider', { name: 'Player name distance' })).toHaveCount(0);
	// The Fabled and Loric are always in the corner (Trevor, 2026-10-30: "only corner").
	await expect(theme.getByRole('combobox', { name: 'Location', exact: true })).toHaveCount(0);

	const saved = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('grim.boardLooks') ?? 'null')
	);
	expect(saved).toEqual({
		vignette: false,
		vignetteStrength: 0.3,
		logo: true,
		logoOpacity: 0.3,
		nameSize: 1,
		nameOffset: 0,
		reminderLines: 'always',
		usedGhostVote: 'hollow',
		abilityLook: 'grimbinder',
		bigToken: 'truth'
	});

	await page.reload();
	const again = await openTheme(page, 'Background');
	await expect(again.getByRole('button', { name: 'Felt', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

// Trevor (2026-10-17): every setting is in Settings too, including the day timer's. Its sound
// is in Sound with every other sound (plan U1), its mode in Storyteller.
test('the day timer sound is in Sound settings and its mode in Storyteller', async ({ page }) => {
	await page.goto('/');
	const sound = await openSettings(page, 'Sound');
	await sound.getByRole('combobox', { name: 'Timer sound' }).tap();
	await page.getByRole('option', { name: 'Chime', exact: true }).tap();
	await page.reload();
	const dialog = await openSettings(page, 'Storyteller');
	await expect(dialog.getByRole('combobox', { name: 'Timer sound' })).toHaveCount(0);
	// Two states, so a switch under the Day timer heading (Trevor, 2026-11-06).
	await dialog.getByText('Stopwatch', { exact: true }).tap();
	// Players' phones always show a sun (Trevor, 2026-10-29), so there is no choice of it.
	await expect(dialog.getByRole('combobox', { name: 'Day timer on players’ phones' })).toHaveCount(
		0
	);
	await page.reload();
	const again = await openSettings(page, 'Storyteller');
	await expect(
		again.getByRole('checkbox', { name: 'Stopwatch', includeHidden: true })
	).toBeChecked();
	// The time per living player too (Trevor, 2026-10-19), from a drop-down (2026-10-30).
	const seconds = again.getByTestId('timer-per-player');
	await expect(seconds).toHaveText('30 seconds');
	await pickNumber(again, 'Seconds per living player', '45 seconds');
	await expect(seconds).toHaveText('45 seconds');
	// A stopwatch has no sound (Trevor, 2026-10-23), so its choice shows disabled.
	await page.reload();
	const soundAgain = await openSettings(page, 'Sound');
	await expect(soundAgain.getByRole('combobox', { name: 'Timer sound' })).toContainText('Chime');
	await expect(soundAgain.getByRole('combobox', { name: 'Timer sound' })).toBeDisabled();
});

test('text size changes text only: icons, spacing and buttons keep their size', async ({
	page
}) => {
	await page.goto('/spikes/icons');
	const settingsButton = menuButton(page);
	const night = page.getByRole('img', { name: 'Night' });
	const measure = async () => ({
		button: await settingsButton.boundingBox(),
		icon: await night.boundingBox(),
		gap: await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--space-4')
		),
		spacePx: await page.evaluate(() => {
			const probe = document.createElement('div');
			probe.style.width = 'var(--space-4)';
			document.body.append(probe);
			const width = probe.getBoundingClientRect().width;
			probe.remove();
			return width;
		}),
		text: await page.evaluate(() => getComputedStyle(document.body).fontSize)
	});
	const before = await measure();

	const dialog = await openSettings(page, 'Text');
	await slide(page, 'Text size', 1.5);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	const after = await measure();

	expect(after.text).not.toBe(before.text);
	expect(after.spacePx).toBe(before.spacePx);
	expect(after.icon?.width).toBe(before.icon?.width);
	expect(after.button?.width).toBe(before.button?.width);
	expect(after.button?.height).toBe(before.button?.height);
});

// Trevor (2026-10-23): About has no settings, so it is its own page in the menu.
test('About is not a settings section', async ({ page }) => {
	await page.goto('/');
	await openSettingsDialog(page);
	const nav = page
		.getByRole('dialog', { name: 'Settings' })
		.getByRole('navigation', { name: 'Settings sections' });
	await expect(nav.getByRole('button', { name: 'Theme', exact: true })).toBeVisible();
	await expect(nav.getByRole('button', { name: 'Data' })).toBeVisible();
	await expect(nav.getByRole('button', { name: 'About' })).toHaveCount(0);
	await expect(nav.getByRole('button', { name: 'Reset settings' })).toHaveCount(0);
});

test('interface icon size changes interface icons only, not text or character icons', async ({
	page
}) => {
	await page.goto('/');
	const settingsIcon = menuButton(page).locator('.icon');
	const before = await settingsIcon.boundingBox();
	const text = await page.evaluate(() => getComputedStyle(document.body).fontSize);

	const dialog = await openSettings(page, 'Icons');
	await slide(page, 'Interface icon size', 1.5);
	expect(await rootStyle(page, '--character-icon-scale')).toBe('1');
	await dialog.getByRole('button', { name: 'Close' }).tap();

	const after = await settingsIcon.boundingBox();
	expect(after!.width).toBeCloseTo(before!.width * 1.5, 0);
	expect(await page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe(text);
});

test('the rules term switch is with theme and text, not Storyteller settings', async ({ page }) => {
	await page.goto('/');
	const help = await openSettings(page, 'Storyteller');
	await expect(
		help.getByRole('region', { name: 'Storyteller', exact: true }).getByText(/rules terms/i)
	).toHaveCount(0);
	await page.reload();
	const terms = await openSettings(page, 'Text');
	await expect(
		terms.getByRole('checkbox', {
			name: 'Underline rules terms with glossary definitions',
			includeHidden: true
		})
	).toBeChecked();
});

test('settings are one list by topic, with no audience groups or Applies to lines', async ({
	page
}) => {
	await page.goto('/');
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	const nav = dialog.getByRole('navigation', { name: 'Settings sections' });
	// Trevor, 2026-10-17: every Storyteller-only setting is in Storyteller settings. (Install
	// app, where offered, sits below the list.)
	await expect(nav.getByRole('list').getByRole('button')).toHaveText([
		'Theme',
		'Text',
		'Icons',
		'Storyteller',
		'Sound',
		'Player',
		'Print',
		'Language',
		'Data'
	]);
	await expect(nav.getByRole('heading')).toHaveCount(0);
	await nav.getByRole('button', { name: 'Storyteller', exact: true }).tap();
	await expect(dialog).not.toContainText('Applies to');
	await expect(dialog.getByRole('heading', { level: 3 })).toHaveText([
		// Setup, Reminders and Day timer have their own headings (Trevor, 2026-11-06).
		'Night',
		'Setup',
		'Bag draw',
		'Day',
		'Reminders',
		'Day timer',
		'PIN and locks',
		'Share',
		'QR codes'
	]);
});

test('text alignment switches body text between left aligned and justified', async ({ page }) => {
	await page.goto('/privacy');
	const paragraph = page.locator('main p').nth(1);
	const align = () => paragraph.evaluate((el) => getComputedStyle(el).textAlign);
	expect(await align()).toBe('start');

	const dialog = await openSettings(page, 'Text');
	// Two states, so a switch (Trevor, 2026-11-06).
	await dialog.getByText('Justify text', { exact: true }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	expect(await align()).toBe('justify');

	// Headings and buttons keep their own alignment; the choice survives a reload.
	await page.reload();
	expect(await align()).toBe('justify');
	const button = menuButton(page);
	expect(await button.evaluate((el) => getComputedStyle(el).textAlign)).toBe('center');
});

test('text size is a percentage slider that applies while it moves', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Text');
	const slider = dialog.getByRole('slider', { name: 'Text size' });
	await expect(slider).toHaveAttribute('aria-valuetext', '100%');
	// The reset icon beside the label is always there, and disabled at the default.
	await expect(await resetButton(dialog, 'Text size')).toBeDisabled();

	// Each step applies as it is reached, without letting go.
	await slider.focus();
	await page.keyboard.press('ArrowRight');
	await expect(slider).toHaveAttribute('aria-valuetext', '105%');
	expect(await rootStyle(page, '--text-scale')).toBe('1.05');
	await slider.fill('1.2');
	await expect(slider).toHaveAttribute('aria-valuetext', '120%');
	expect(await rootStyle(page, '--text-scale')).toBe('1.2');

	await page.reload();
	const again = await openSettings(page, 'Text');
	await expect(again.getByRole('slider', { name: 'Text size' })).toHaveAttribute(
		'aria-valuetext',
		'120%'
	);

	// Tapping the reset icon puts the default back at once.
	await (await resetButton(again, 'Text size')).tap();
	await expect(again.getByRole('slider', { name: 'Text size' })).toHaveAttribute(
		'aria-valuetext',
		'100%'
	);
	expect(await rootStyle(page, '--text-scale')).toBe('1');
	await expect(await resetButton(again, 'Text size')).toBeDisabled();
});

// Plan U1 (Trevor, 2026-10-26): one volume for every sound, kept on this device.
test('Sound has one volume for every sound, saved on the device', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Sound');
	const slider = dialog.getByRole('slider', { name: 'Volume', exact: true });
	await expect(slider).toHaveAttribute('aria-valuetext', '100%');
	await expect(dialog.getByRole('checkbox', { name: 'Vibrate' })).toBeVisible();
	// No Back to town sound of the phone's own: the Storyteller picks it (Trevor, 2026-11-06).
	await expect(dialog.getByRole('combobox', { name: 'Back to town sound' })).toHaveCount(0);
	await slider.fill('0.4');
	await expect(slider).toHaveAttribute('aria-valuetext', '40%');

	await page.reload();
	const again = await openSettings(page, 'Sound');
	await expect(again.getByRole('slider', { name: 'Volume', exact: true })).toHaveAttribute(
		'aria-valuetext',
		'40%'
	);
	await (await resetButton(again, 'Volume')).tap();
	await expect(again.getByRole('slider', { name: 'Volume', exact: true })).toHaveAttribute(
		'aria-valuetext',
		'100%'
	);
});

// Plan U11 (Trevor, 2026-10-27: "options for output (eg device speakers, external speakers")):
// Chrome and Edge on a computer can choose; a phone's own output switcher decides there.
test('Sound has a speaker choice, disabled where the browser cannot choose', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Sound');
	const speaker = dialog.getByRole('combobox', { name: 'Speaker', exact: true });
	await expect(speaker).toContainText('Device default');
	const can = await page.evaluate(
		() => 'setSinkId' in AudioContext.prototype && !/Android/i.test(navigator.userAgent)
	);
	if (can) await expect(speaker).toBeEnabled();
	else await expect(speaker).toBeDisabled();
});

test('every theme, text and icon size setting has a reset icon beside its name', async ({
	page
}) => {
	await page.goto('/');
	const theme = await openSettings(page, 'Theme');
	await expect(await resetButton(theme, 'Theme')).toBeDisabled();
	const back0 = theme.getByRole('button', { name: 'All settings' });
	if (await back0.isVisible()) await back0.tap();
	await theme
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Text', exact: true })
		.tap();
	const dialog = theme;
	await expect(await resetButton(dialog, 'Text size')).toBeDisabled();
	const back = dialog.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) await back.tap();
	await dialog.getByRole('button', { name: 'Icons' }).tap();
	await expect(await resetButton(dialog, 'Interface icon size')).toBeDisabled();
});

test('each settings section opens at its top, wherever the last one was scrolled', async ({
	page
}, testInfo) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Text');
	const content = dialog.locator('section.content');
	await content.evaluate((el) => (el.scrollTop = el.scrollHeight));
	expect(await content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

	if (testInfo.project.name === 'phone') {
		await dialog.getByRole('button', { name: 'All settings' }).tap();
	}
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Icons' })
		.tap();
	await expect(dialog.getByRole('heading', { name: 'Icons', level: 2 })).toBeVisible();
	expect(await content.evaluate((el) => el.scrollTop)).toBe(0);
});

// Trevor (2026-10-18): each font sits beside its own sample, so the font list is no longer
// pinned; the section's name row still stays at the top while the section scrolls.
test('the font list scrolls with the Text section, under its sticky name row', async ({ page }) => {
	await page.setViewportSize({ width: page.viewportSize()!.width, height: 480 });
	await page.goto('/');
	const dialog = await openSettings(page, 'Text');
	const fonts = dialog.getByTestId('font-preview');
	const content = dialog.locator('section.content');
	await content.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	expect(await content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	await expect(fonts.locator('.line').first()).not.toBeInViewport();
	const heading = dialog.getByRole('heading', { name: 'Text', exact: true, level: 2 });
	await expect(heading).toBeInViewport();
	const row = (await heading.locator('..').boundingBox())!;
	expect(Math.abs(row.y - (await content.boundingBox())!.y)).toBeLessThan(2);
	const back = dialog.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) {
		await expect(back).toHaveText('');
		expect(Math.abs((await back.boundingBox())!.y - row.y)).toBeLessThan(2);
	}
});

test('every theme colour is its own setting, warns on low contrast, and Reset Theme puts them back', async ({
	page
}) => {
	// Trevor (2026-10-18): a custom value for every theme colour; a reset in each section header.
	await page.goto('/');
	const dialog = await openSettings(page, 'Theme');
	await dialog.getByRole('button', { name: 'Accents and buttons' }).tap();
	const accent = dialog.getByLabel('Accent', { exact: true });
	const onAccent = dialog.getByLabel('Text on accent', { exact: true });
	const original = (await rootStyle(page, '--on-accent')).trim();
	const warning = dialog.getByRole('button', { name: 'Low contrast' });
	await expect(warning).toHaveCount(0);
	// Text the same colour as the accent can't be read: warned in place, never blocked.
	await onAccent.fill(await accent.inputValue());
	expect((await rootStyle(page, '--on-accent')).trim()).toBe(await accent.inputValue());
	await expect(warning.first()).toBeVisible();

	await dialog.getByRole('button', { name: 'Reset Theme' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Reset Theme?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(confirm).toBeHidden();
	expect((await rootStyle(page, '--on-accent')).trim()).toBe(original);
	await expect(warning).toHaveCount(0);
});

// Trevor (2026-10-19): two thumbs on the screen zoomed the whole app by accident. Pinch to zoom
// is off by default and a switch in Settings > Text turns it back on (back from Board, 2026-11-18).
test('a pinch never zooms the app unless Pinch to zoom is on', async ({ page }) => {
	await page.goto('/');
	await expect(menuButton(page)).toBeVisible();
	// Chromium's emulated touch pinch never zooms, even when allowed, so this pinches the way a
	// trackpad does, which obeys the same viewport limits as Android. iOS ignores those limits;
	// there base.css's touch-action and the cancelled gesture events stop it (not testable here).
	const cdp = await page.context().newCDPSession(page);
	const pinch = async () => {
		await cdp.send('Input.synthesizePinchGesture', {
			x: 150,
			y: 300,
			scaleFactor: 2,
			gestureSourceType: 'mouse'
		});
		return page.evaluate(() => window.visualViewport?.scale ?? 1);
	};
	expect(await pinch()).toBe(1);
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe(
		'pan-x pan-y'
	);

	const dialog = await openSettings(page, 'Text');
	const zoom = dialog.getByRole('checkbox', { name: 'Pinch to zoom', includeHidden: true });
	await expect(zoom).not.toBeChecked();
	await dialog.getByText('Pinch to zoom', { exact: true }).tap();
	await expect(zoom).toBeChecked();
	await dialog.getByRole('button', { name: 'Close' }).first().tap();
	await expect(dialog).toBeHidden();
	expect(await pinch()).toBeGreaterThan(1.5);
});

// Trevor (2026-10-20): an Install app button at the very bottom of Settings, so installing
// needs no know-how. The phone project is an iPhone (Safari: written steps); the tablet is
// Android (Chrome: the browser's own prompt).
test('Install app at the bottom of Settings uses the browser prompt, or the iPhone steps', async ({
	page
}, testInfo) => {
	await page.goto('/');
	await expect(menuButton(page)).toBeVisible();
	if (testInfo.project.name !== 'phone') {
		// What Chrome sends when the app can be installed, once the app is listening for it.
		await expect
			.poll(() =>
				page.evaluate(() => {
					const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
						prompt: async () => {
							(window as { __prompted?: number }).__prompted = 1;
						},
						userChoice: Promise.resolve({ outcome: 'accepted' })
					});
					dispatchEvent(event);
					return event.defaultPrevented;
				})
			)
			.toBe(true);
	}
	await openSettingsDialog(page);
	const nav = page
		.getByRole('dialog', { name: 'Settings' })
		.getByRole('navigation', { name: 'Settings sections' });
	const install = nav.getByRole('button', { name: 'Install app' });
	// Last in the list, below every section.
	const lastSection = await nav.getByRole('listitem').last().boundingBox();
	const button = await install.boundingBox();
	expect(button!.y).toBeGreaterThan(lastSection!.y + lastSection!.height - 1);
	expect(button!.height).toBeGreaterThanOrEqual(43.9);
	await install.tap();
	if (testInfo.project.name === 'phone') {
		const steps = page.getByRole('dialog', { name: 'Install app' }).getByTestId('install-steps');
		await expect(steps.getByRole('listitem')).toHaveText([
			/Tap ⋯ beside the address/,
			/Tap Share/,
			/Tap Add to Home Screen/,
			/Tap Add/
		]);
	} else {
		await expect
			.poll(() => page.evaluate(() => (window as { __prompted?: number }).__prompted))
			.toBe(1);
		// Installed: no button.
		await expect(install).toHaveCount(0);
	}
});

test('opened as an installed app, Settings has no Install app button', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
	);
	await page.goto('/');
	await openSettingsDialog(page);
	const nav = page.getByRole('navigation', { name: 'Settings sections' });
	await expect(nav.getByRole('button', { name: 'Data' })).toBeVisible();
	await expect(nav.getByRole('button', { name: 'Install app' })).toHaveCount(0);
});

// Trevor, 2026-10-27: Print has its own settings section; Player keeps Sheet background.
test('Print has its own section with the printed sheet settings and a reset', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Print');
	const fields = dialog.getByTestId('print-settings');
	await expect(fields.getByRole('combobox', { name: 'Columns' })).toBeVisible();
	// The Front's Jinxes; the Back has its own (Trevor, 2026-10-29).
	const jinxes = fields.getByRole('checkbox', { name: 'Jinxes', includeHidden: true }).first();
	await expect(jinxes).toBeChecked();
	await fields.getByText('Jinxes', { exact: true }).first().tap();
	await expect(jinxes).not.toBeChecked();
	await page.reload();
	const again = await openSettings(page, 'Player');
	await expect(again.getByTestId('print-settings')).toHaveCount(0);
	await expect(again.getByRole('combobox', { name: 'Sheet background' })).toBeVisible();
	await page.reload();
	const print = await openSettings(page, 'Print');
	await expect(
		print
			.getByTestId('print-settings')
			.getByRole('checkbox', { name: 'Jinxes', includeHidden: true })
			.first()
	).not.toBeChecked();
});
