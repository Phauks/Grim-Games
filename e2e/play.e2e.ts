import { expect, test } from '@playwright/test';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';

// Player view (09-player-script-view.md): a reading page with the script, night order and notes.

test.beforeEach(async ({ page }) => {
	await page.goto('/play');
	// No script yet: the base three are offered here, since /scripts no longer lists them.
	await expect(page.getByRole('link', { name: 'Find a script' })).toHaveAttribute(
		'href',
		'/scripts'
	);
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
});

test('the player view is a reading page, with no Storyteller controls', async ({ page }) => {
	// Script, night order and notes only (Trevor, 2026-10-16: "nothing close to ... controls").
	await expect(page.getByRole('tab')).toHaveText(['Script', 'Night', 'Notes']);
	await expect(page.getByTestId('seat-ring')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /seat/i })).toHaveCount(0);
});

test('notes written on a seat by an older version are kept as titled notes', async ({ page }) => {
	// A v4 notebook from when /play had a seat circle (notebook.ts migrateNotebook).
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const open = indexedDB.open('grim-games-player', 1);
				open.onsuccess = () => {
					const tx = open.result.transaction('notebooks', 'readwrite');
					tx.objectStore('notebooks').put({
						schemaVersion: 4,
						scriptKey: 'edition:tb',
						notes: [{ noteId: 'n1', title: 'Mine', text: 'Chef 0' }],
						seats: [
							{ seatId: 's1', name: '', note: '' },
							{ seatId: 's2', name: 'Sam', note: 'Claimed Chef' }
						],
						updatedAt: 1
					});
					tx.oncomplete = () => {
						open.result.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
				open.onerror = () => reject(open.error);
			})
	);
	await page.reload();
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await expect(page.locator('[data-note]')).toHaveCount(2);
	await expect(page.getByRole('button', { name: /Seat 2 · Sam\s*Claimed Chef/ })).toBeVisible();
});

test('the script tab lists characters by type with their abilities', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Townsfolk' })).toBeVisible();
	// 22 on the character sheet plus its 5 recommended Travellers (wiki: Trouble Brewing).
	await expect(page.locator('[data-character]')).toHaveCount(27);
	await expect(page.getByRole('heading', { name: 'Recommended Travellers' })).toBeVisible();
	await expect(page.locator('[data-character="scapegoat"]')).toBeVisible();
	const empath = page.locator('[data-character="empath"]');
	await expect(empath).toContainText('Each night, you learn how many of your 2 alive neighbors');
	await empath.getByRole('button', { name: /Empath/ }).tap();
	await expect(page.getByRole('dialog', { name: 'Empath' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open wiki' })).toHaveAttribute(
		'href',
		/wiki\.bloodontheclocktower\.com\/Empath/
	);
	await page.keyboard.press('Escape');
	// Wait for the dialog to go: its wiki section list has a Jinxes button too.
	await expect(page.getByRole('dialog', { name: 'Empath' })).toBeHidden();
	await expect(page.getByTestId('no-jinxes')).toHaveText('None');

	// Sections close from their header and stay closed after a reload (Trevor, 2026-10-16).
	const panel = page.getByRole('tabpanel', { name: 'Script' });
	const jinxes = panel.getByRole('button', { name: 'Jinxes' });
	await expect(jinxes).toHaveAttribute('aria-expanded', 'true');
	await jinxes.tap();
	await expect(page.getByTestId('no-jinxes')).toBeHidden();
	// The * legend explains ability text, so it stays when Players closes (Trevor).
	await panel.getByRole('button', { name: 'Players', exact: true }).tap();
	await expect(page.getByText('* Not the first night')).toBeVisible();
	await panel.getByRole('button', { name: 'Townsfolk', exact: true }).tap();
	await expect(empath).toBeHidden();
	await page.reload();
	await expect(
		page.getByRole('tabpanel', { name: 'Script' }).getByRole('button', { name: 'Jinxes' })
	).toHaveAttribute('aria-expanded', 'false');
	await expect(empath).toBeHidden();
	await page.getByRole('button', { name: 'Townsfolk', exact: true }).tap();
	await expect(empath).toBeVisible();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('tapping a player count highlights its column, and it is remembered', async ({ page }) => {
	const panel = page.getByRole('tabpanel', { name: 'Script' });
	const seven = panel.getByRole('button', { name: '7 players' });
	await expect(seven).toHaveAttribute('aria-pressed', 'false');
	await seven.tap();
	await expect(seven).toHaveAttribute('aria-pressed', 'true');
	// 7 players: 5 Townsfolk, 0 Outsiders, 1 Minion, 1 Demon (wiki: Setup).
	await expect(panel.locator('td[data-current]')).toHaveText(['5', '0', '1', '1']);
	await page.reload();
	await expect(seven).toHaveAttribute('aria-pressed', 'true');
	await seven.tap();
	await expect(seven).toHaveAttribute('aria-pressed', 'false');
	await expect(panel.locator('td[data-current]')).toHaveCount(0);
	// Anywhere in a column picks it, not just its number (Trevor, 2026-10-17).
	await panel.locator('tbody tr[data-type="minion"] td').nth(2).tap();
	await expect(seven).toHaveAttribute('aria-pressed', 'true');
});

test("the night order shows who wakes, with TPI's night text", async ({ page }) => {
	await page.getByRole('tab', { name: 'Night', exact: true }).tap();
	const first = page.locator('section[data-night="first"]');
	// Dusk, Minion info, Demon info and Dawn show their own icons (Trevor, 2026-10-16).
	const minionInfo = first.locator('li[data-step="minioninfo"]');
	await expect(minionInfo).toContainText('Minion info');
	await expect(minionInfo.locator('.token[data-marker="minioninfo"]')).toBeVisible();
	const poisoner = first.locator('li[data-step="poisoner"]');
	// Icon two lines tall, the name beside it, and tapping the name shows the ability.
	await poisoner.locator('button.name').tap();
	const dialog = page.getByRole('dialog', { name: 'Poisoner' });
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	// TPI's text, with its :reminder: drawn as the Poisoner's token.
	await expect(poisoner).toContainText('chooses a player');
	await expect(poisoner).not.toContainText(':reminder:');
	const other = page.locator('section[data-night="other"]');
	await expect(other.locator('li[data-step="imp"]')).toContainText('chooses a player');
});

test('titled notes are kept after a reload, and deleting asks first', async ({ page }) => {
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: /^Untitled/ }).tap();
	let sheet = page.getByRole('dialog', { name: 'Note' });
	// Opening a note doesn't focus a field, so the phone keyboard stays closed (Trevor).
	await expect(sheet.getByRole('textbox', { name: 'Title' })).toBeVisible();
	await expect(sheet.getByRole('textbox', { name: 'Title' })).not.toBeFocused();
	await expect(sheet.getByRole('textbox', { name: 'Text' })).not.toBeFocused();
	await sheet.getByRole('textbox', { name: 'Title' }).fill('What I really know');
	await sheet.getByRole('textbox', { name: 'Text' }).fill('Sam is the Imp');
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: 'New note' }).tap();
	sheet = page.getByRole('dialog', { name: 'Note' });
	await sheet.getByRole('textbox', { name: 'Title' }).fill('My bluff');
	await sheet.getByRole('textbox', { name: 'Text' }).fill('Chef: 0');
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-note]')).toHaveCount(2);

	await page.waitForTimeout(500);
	await page.reload();
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await expect(
		page.getByRole('button', { name: /What I really know\s*Sam is the Imp/ })
	).toBeVisible();

	await page.getByRole('button', { name: /^My bluff/ }).tap();
	sheet = page.getByRole('dialog', { name: 'Note' });
	// Every delete is the red trash can alone, no text (Trevor, 2026-10-17).
	const del = sheet.getByRole('button', { name: 'Delete note' });
	await expect(del).toHaveText('');
	await expect(del.locator('[data-icon]')).toBeVisible();
	const box = (await del.boundingBox())!;
	expect(box.width).toBeGreaterThanOrEqual(44);
	expect(box.height).toBeGreaterThanOrEqual(44);
	const colours = await del.evaluate((el) => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--evil)';
		el.append(probe);
		const evil = getComputedStyle(probe).color;
		probe.remove();
		return { own: getComputedStyle(el).color, evil };
	});
	expect(colours.own).toBe(colours.evil);
	await del.tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete this note?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.locator('[data-note]')).toHaveCount(1);
});

test('each script keeps its own notebook', async ({ page }) => {
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: /^Untitled/ }).tap();
	await page
		.getByRole('dialog', { name: 'Note' })
		.getByRole('textbox', { name: 'Title' })
		.fill('TB');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(500);

	// Players have no Change script button (Trevor): the script comes from /scripts or a link.
	await expect(page.getByRole('link', { name: 'Change script' })).toHaveCount(0);
	await page.goto(`/play#e=bmr`);
	await expect(page.getByRole('heading', { name: 'Bad Moon Rising', level: 1 })).toBeVisible();
	// A new script starts its own notebook; Trouble Brewing's is kept.
	await expect(page.getByRole('button', { name: /^Untitled/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^TB/ })).toHaveCount(0);
	await page.goto('/play#e=tb');
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await expect(page.getByRole('button', { name: /^TB/ })).toBeVisible();
});

test('a homebrew character from a loaded script shows as a badge with its ability', async ({
	page
}) => {
	await page.goto('/library');
	await page.getByLabel('Script file').setInputFiles({
		name: 'storm-front.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify([
				{ id: '_meta', name: 'Storm Front', author: 'Trevor' },
				'chef',
				{
					id: 'stormwarden',
					name: 'Storm Warden',
					team: 'townsfolk',
					ability: 'Each night, choose a player: they are safe from the Demon tonight.'
				},
				'imp'
			])
		)
	});
	await expect(page.getByTestId('script-details-name')).toHaveText('Storm Front');
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Storm Front', level: 1 })).toBeVisible();
	const row = page.locator('[data-character="stormwarden"]');
	await expect(row.getByRole('button', { name: /Storm Warden/ })).toBeVisible();
	await expect(row).toContainText('safe from the Demon tonight');
});

test('a shared /play link opens its script, and the script can be shared on', async ({ page }) => {
	const shared = [
		{ id: '_meta', name: 'Pass The Phone', author: 'Trevor' },
		'chef',
		'empath',
		'imp'
	];
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	await expect(page.getByRole('heading', { name: 'Pass The Phone', level: 1 })).toBeVisible();
	await expect(page.getByTestId('script-byline')).toHaveText('by Trevor');
	await expect(page.locator('[data-character]')).toHaveCount(3);
	// The hash is cleared once the script is loaded.
	await expect(page).toHaveURL(/\/play$/);
	await expect(page.getByRole('button', { name: 'Share script' })).toBeEnabled();

	// Opened fresh from another page, as from a QR code.
	const other = [{ id: '_meta', name: 'Second Script' }, 'washerwoman', 'imp'];
	await page.goto('/');
	await page.goto(`/play#s=${await encodeSharedScript(other)}`);
	await expect(page.getByRole('heading', { name: 'Second Script', level: 1 })).toBeVisible();
});

test('the header shares the script from an icon and has no Code button', async ({ page }) => {
	const shared = [{ id: '_meta', name: 'Code Night' }, 'chef', 'empath', 'imp'];
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	await expect(page.getByRole('heading', { name: 'Code Night', level: 1 })).toBeVisible();
	// No author in the script: the byline is left out, not "None" (Trevor, 2026-10-17).
	await expect(page.getByTestId('script-byline')).toHaveCount(0);
	// Players are already in a script, so there is no code to enter here (Trevor, 2026-10-16).
	await expect(page.getByRole('button', { name: 'Code', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Share script' }).tap();
	const qr = page.getByRole('dialog', { name: 'Share Code Night' });
	await expect(qr.getByTestId('share-url')).toHaveValue(/\/play#c=\d{6}$/);
	await expect(qr.getByTestId('share-digits')).toHaveCount(0);
});

test('a shared link with problems opens the Script check first', async ({ page }) => {
	const shared = [{ id: '_meta', name: 'Typo Script' }, 'chef', 'fortune_teler', 'imp'];
	await page.goto('/');
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	const check = page.getByRole('dialog', { name: 'Script check' });
	await expect(check).toContainText('Did you mean Fortune Teller');
	await check.getByRole('button', { name: 'Load anyway' }).tap();
	await expect(page.getByRole('heading', { name: 'Typo Script', level: 1 })).toBeVisible();
	await expect(page.locator('[data-character]')).toHaveCount(2);
});

test('note contents can be hidden until a note is opened', async ({ page }) => {
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: /^Untitled/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Note' });
	await sheet.getByRole('textbox', { name: 'Title' }).fill('Evil team');
	await sheet.getByRole('textbox', { name: 'Text' }).fill('Sam is the Imp');
	await page.keyboard.press('Escape');
	const row = page.locator('[data-note]');
	await expect(row).toContainText('Sam is the Imp');

	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Player view' })
		.tap();
	const hide = settings.getByRole('checkbox', { name: 'Hide note contents', includeHidden: true });
	await expect(hide).not.toBeChecked();
	await settings.getByText('Hide note contents', { exact: true }).tap();
	await expect(hide).toBeChecked();
	await settings.getByRole('button', { name: 'Close' }).tap();

	// The title stays so notes can be found; the text is hidden (Trevor, 2026-10-16).
	await expect(row).toHaveText(/^\s*Evil team\s*Hidden\s*$/);
	await expect(row).not.toContainText('Sam is the Imp');
	// Opening the note shows it.
	await row.tap();
	await expect(sheet.getByRole('textbox', { name: 'Text' })).toHaveValue('Sam is the Imp');
	await page.keyboard.press('Escape');
	// Kept after a reload.
	await page.reload();
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await expect(page.locator('[data-note]')).toHaveText(/^\s*Evil team\s*Hidden\s*$/);
});

test('Enter in a note title closes the keyboard', async ({ page }) => {
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: /^Untitled/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Note' });
	const title = sheet.getByRole('textbox', { name: 'Title' });
	await title.fill('Bluff');
	await title.press('Enter');
	await expect(title).not.toBeFocused();
	// Note text is multi-line: Enter is a new line there.
	const text = sheet.getByRole('textbox', { name: 'Text' });
	await text.fill('one');
	await text.press('Enter');
	await text.pressSequentially('two');
	await expect(text).toHaveValue('one\ntwo');
});

test('a jinxed character shows its partners beside its name, and tapping shows the jinx', async ({
	page
}) => {
	const shared = [{ id: '_meta', name: 'Jinx Night' }, 'alchemist', 'chef', 'marionette', 'imp'];
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	await expect(page.getByRole('heading', { name: 'Jinx Night', level: 1 })).toBeVisible();
	// TPI jinx: Alchemist and Marionette (wiki: Djinn's Jinxes list).
	const mark = page.locator('[data-character="alchemist"] [data-testid="jinx-mark"]');
	await expect(mark).toHaveAccessibleName('Jinxed with Marionette');
	await expect(page.locator('[data-character="chef"] [data-testid="jinx-mark"]')).toHaveCount(0);
	await mark.tap();
	const dialog = page.getByRole('dialog', { name: 'Jinxes' });
	await expect(dialog).toContainText('Marionette ability');
});

test('the Script sheet can be made compact from Settings', async ({ page }) => {
	await expect(page.locator('[data-density="normal"]')).toBeVisible();
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Player view' })
		.tap();
	await settings.getByText('Super-compact', { exact: true }).tap();
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(page.locator('[data-density="super"]')).toBeVisible();
	await page.reload();
	await expect(page.locator('[data-density="super"]')).toBeVisible();
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test('Print script prints the sheet, then the night order and player counts', async ({ page }) => {
	await page.evaluate(() => {
		window.print = () => {
			const sheet = document.querySelector('[data-testid="print-sheet"]');
			(window as unknown as { printed: string }).printed = sheet?.textContent ?? '';
		};
	});
	await page.getByRole('button', { name: 'Print script' }).tap();
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { printed?: string }).printed))
		.toContain('First night');
	const printed = await page.evaluate(() => (window as unknown as { printed: string }).printed);
	expect(printed).toContain('Washerwoman');
	expect(printed).toContain('Other nights');
	// The page itself is unchanged.
	await expect(page.getByRole('tabpanel', { name: 'Script' })).toBeVisible();
});
