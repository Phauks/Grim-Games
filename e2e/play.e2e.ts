import { expect, test } from '@playwright/test';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';

// Player view (09-player-script-view.md): the script, night order, a private seat circle and notes.

test.beforeEach(async ({ page }) => {
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
});

test('the script tab lists characters by type with their abilities', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Townsfolk' })).toBeVisible();
	await expect(page.locator('[data-character]')).toHaveCount(22);
	const empath = page.locator('[data-character="empath"]');
	await expect(empath).toContainText('Each night, you learn how many of your 2 alive neighbors');
	await empath.getByRole('button', { name: /Empath/ }).tap();
	await expect(page.getByRole('dialog', { name: 'Empath' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open wiki entry' })).toHaveAttribute(
		'href',
		/wiki\.bloodontheclocktower\.com\/Empath/
	);
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('no-jinxes')).toHaveText('None');

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test("the night order shows who wakes, with TPI's night text", async ({ page }) => {
	await page.getByRole('tab', { name: 'Night', exact: true }).tap();
	const first = page.locator('section[data-night="first"]');
	await expect(first.locator('[data-marker="minioninfo"]')).toBeVisible();
	const poisoner = first.locator('li[data-step="poisoner"]');
	await expect(poisoner.getByRole('button', { name: /Poisoner/ }).first()).toBeVisible();
	// TPI's text, with its :reminder: drawn as the Poisoner's token.
	await expect(poisoner).toContainText('chooses a player');
	await expect(poisoner).not.toContainText(':reminder:');
	const other = page.locator('section[data-night="other"]');
	await expect(other.locator('li[data-step="imp"]')).toContainText('chooses a player');
});

test('the circle keeps names, guesses and deaths on this device', async ({ page }) => {
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await expect(page.getByTestId('seat-count')).toHaveText('8');
	await page.getByRole('button', { name: 'Add a seat' }).tap();
	await expect(page.getByTestId('seat-count')).toHaveText('9');

	await page.getByRole('button', { name: /^Seat 3/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Seat 3' });
	await expect(sheet).toBeVisible();
	await sheet.getByRole('textbox', { name: 'Name' }).fill('Alex');
	await expect(sheet.getByRole('button', { name: 'I think they are None' })).toBeVisible();
	await sheet.getByRole('button', { name: /^I think they are/ }).tap();
	// The shared character picker, searchable (Trevor, 2026-10-16).
	const picker = page.getByRole('dialog', { name: 'I think they are' });
	await picker.getByRole('searchbox', { name: 'Search characters' }).fill('emp');
	await expect(picker.getByRole('button', { name: 'Investigator' })).toBeHidden();
	await picker.getByRole('button', { name: 'Empath', exact: true }).tap();
	await expect(picker).toBeHidden();
	await expect(sheet.getByRole('button', { name: 'I think they are Empath' })).toBeVisible();
	await sheet.getByText('Dead', { exact: true }).tap();
	await page.keyboard.press('Escape');

	const seat = page.getByRole('button', { name: /^Seat 3, Alex, guess Empath, dead/ });
	await expect(seat).toBeVisible();
	await expect(page.getByTestId('alive-count')).toHaveText('8 alive');
	await expect(page.getByTestId('storage-note')).toHaveText(/Saved on this device only/);

	// Saved locally: a reload brings it back.
	await page.waitForTimeout(500);
	await page.reload();
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await expect(page.getByTestId('seat-count')).toHaveText('9');
	await expect(
		page.getByRole('button', { name: /^Seat 3, Alex, guess Empath, dead/ })
	).toBeVisible();
});

test('seats can be arranged like the real table, and stay that way', async ({ page }) => {
	await page.getByRole('tab', { name: 'Circle' }).tap();
	const board = page.getByTestId('seat-ring');
	const seat5 = page.getByRole('button', { name: /^Seat 5/ });
	await expect(seat5).toBeVisible();
	await page.getByRole('button', { name: 'Arrange seats' }).tap();

	// A gap after seat 2 (a doorway), tapped up to two places.
	const gap = page.getByRole('button', { name: /^Gap after seat 2/ });
	await expect(gap).toHaveAccessibleName('Gap after seat 2: None');
	await gap.tap();
	await gap.tap();
	await expect(gap).toHaveAccessibleName('Gap after seat 2: 2');

	// Drag seat 5 into the middle, as if they sat on a couch apart from the circle.
	const box = (await board.boundingBox())!;
	const from = (await seat5.locator('.face').boundingBox())!;
	const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
	const end = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.45 };
	await seat5.dispatchEvent('pointerdown', {
		pointerId: 1,
		isPrimary: true,
		clientX: start.x,
		clientY: start.y
	});
	for (const t of [0.3, 0.7, 1])
		await seat5.dispatchEvent('pointermove', {
			pointerId: 1,
			isPrimary: true,
			clientX: start.x + (end.x - start.x) * t,
			clientY: start.y + (end.y - start.y) * t
		});
	await seat5.dispatchEvent('pointerup', {
		pointerId: 1,
		isPrimary: true,
		clientX: end.x,
		clientY: end.y
	});
	// Dragging while arranging never opens the seat.
	await expect(page.getByRole('dialog', { name: 'Seat 5' })).toBeHidden();
	await page.getByTestId('seat-ring').locator('..').getByText('Circle', { exact: true }).tap();
	await page.getByRole('button', { name: 'Done' }).tap();
	await expect(page.getByRole('button', { name: /^Gap after seat/ })).toHaveCount(0);

	// Where seat 5 sits, as a share of the board (the page may have scrolled).
	const share = async () => {
		const b = (await board.boundingBox())!;
		const f = (await page
			.getByRole('button', { name: /^Seat 5/ })
			.locator('.face')
			.boundingBox())!;
		return {
			x: Math.round(((f.x + f.width / 2 - b.x) / b.width) * 100),
			y: Math.round(((f.y + f.height / 2 - b.y) / b.height) * 100)
		};
	};
	expect(await share()).toEqual({ x: 50, y: 45 });

	// Kept on this device.
	await page.waitForTimeout(500);
	await page.reload();
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await expect.poll(share).toEqual({ x: 50, y: 45 });
	await page.getByRole('button', { name: 'Arrange seats' }).tap();
	await expect(page.getByRole('button', { name: /^Gap after seat 2/ })).toHaveAccessibleName(
		'Gap after seat 2: 2'
	);
	await expect(page.getByRole('checkbox', { name: 'Circle' })).toBeChecked();
});

test('titled notes are kept after a reload, and deleting asks first', async ({ page }) => {
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await expect(page.getByTestId('no-player-notes')).toHaveText('None');
	await page.getByRole('button', { name: /^Untitled/ }).tap();
	let sheet = page.getByRole('dialog', { name: 'Note' });
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
	await sheet.getByRole('button', { name: 'Delete note' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete this note?' });
	await confirm.getByRole('button', { name: 'Delete' }).tap();
	await expect(page.locator('[data-note]')).toHaveCount(1);
});

test('notes on a player show in Notes and mark their token', async ({ page }) => {
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await page.getByRole('button', { name: /^Seat 2/ }).tap();
	const sheet = page.getByRole('dialog', { name: 'Seat 2' });
	await sheet.getByRole('textbox', { name: 'Name' }).fill('Sam');
	await sheet.getByRole('textbox', { name: 'Notes on this player' }).fill('Claimed Chef');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /^Seat 2, Sam, has notes/ })).toBeVisible();
	await expect(page.locator('[data-seat="s2"] [data-testid="has-notes"]')).toBeVisible();

	await page.getByRole('tab', { name: 'Notes' }).tap();
	const entry = page.locator('[data-player-note="s2"]');
	await expect(entry).toContainText('Seat 2 · Sam');
	await expect(entry).toContainText('Claimed Chef');
	await entry.tap();
	await expect(page.getByRole('dialog', { name: 'Seat 2' })).toBeVisible();
});

test('shows the script chosen on the Scripts page, with its own notebook', async ({ page }) => {
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await page.getByRole('button', { name: 'Add a seat' }).tap();
	await expect(page.getByTestId('seat-count')).toHaveText('9');

	await page.getByRole('link', { name: 'Change script' }).tap();
	await expect(page).toHaveURL(/\/scripts$/);
	await page.getByRole('button', { name: 'Bad Moon Rising' }).tap();
	await expect(page.getByRole('button', { name: 'Bad Moon Rising' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Bad Moon Rising', level: 1 })).toBeVisible();
	await expect(page.locator('[data-character="grandmother"]')).toBeVisible();
	await page.getByRole('tab', { name: 'Circle' }).tap();
	// A new script starts its own circle; Trouble Brewing's is kept.
	await expect(page.getByTestId('seat-count')).toHaveText('8');
});

test('a homebrew character from a loaded script shows as a badge with its ability', async ({
	page
}) => {
	await page.goto('/scripts');
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
	await expect(page.getByTestId('current-script-name')).toHaveText('Storm Front');
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
	await expect(page.locator('[data-character]')).toHaveCount(3);
	// The hash is cleared once the script is loaded.
	await expect(page).toHaveURL(/\/play$/);
	await expect(page.getByRole('button', { name: 'QR code' })).toBeEnabled();

	// Opened fresh from another page, as from a QR code.
	const other = [{ id: '_meta', name: 'Second Script' }, 'washerwoman', 'imp'];
	await page.goto('/');
	await page.goto(`/play#s=${await encodeSharedScript(other)}`);
	await expect(page.getByRole('heading', { name: 'Second Script', level: 1 })).toBeVisible();
});

test('a word code loads its script on /play', async ({ page }) => {
	const shared = [{ id: '_meta', name: 'Code Night' }, 'chef', 'empath', 'imp'];
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	await expect(page.getByRole('heading', { name: 'Code Night', level: 1 })).toBeVisible();
	await page.getByRole('button', { name: 'QR code' }).tap();
	const qr = page.getByRole('dialog', { name: 'Code Night QR code' });
	const shownWords = qr.getByTestId('share-word');
	await expect(shownWords).toHaveCount(4);
	const words = await shownWords.allTextContents();

	// Switch away, then come back with the code, as a player at the table would.
	await page.goto('/scripts');
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await page.goto('/play');
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	await page.getByRole('button', { name: 'Code', exact: true }).tap();
	const entry = page.getByRole('dialog', { name: 'Have a code?' });
	const box = entry.getByLabel('Type or tap the words');
	await box.fill(`${words.join(' ')} `);
	await box.dispatchEvent('input');
	await entry.getByRole('button', { name: 'Load' }).tap();
	await expect(page.getByRole('heading', { name: 'Code Night', level: 1 })).toBeVisible();
	await expect(entry).toBeHidden();
	await expect(page.locator('[data-character]')).toHaveCount(3);
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

test('Enter in a name or note title closes the keyboard', async ({ page }) => {
	await page.getByRole('tab', { name: 'Circle' }).tap();
	await page.getByRole('button', { name: /^Seat 1/ }).tap();
	const name = page.getByRole('dialog', { name: 'Seat 1' }).getByRole('textbox', { name: 'Name' });
	await name.fill('Alex');
	await name.press('Enter');
	await expect(name).not.toBeFocused();
	await expect(name).toHaveValue('Alex');
	await page.keyboard.press('Escape');

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
