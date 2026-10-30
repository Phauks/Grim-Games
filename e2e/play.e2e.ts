import { expect, test, type Locator, type Page } from '@playwright/test';
import { openPlayerSettings, openProfile, setPlayerName } from './player-name.ts';
import { expectMatchingIconRow } from './icon-row.ts';
import { toBoard } from './new-game.ts';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';

// Player view (09-player-script-view.md): a reading page with the script, night order and notes.

/**
 * Notes save a moment after typing (a debounce, then IndexedDB). A test waits for what is
 * actually stored before it reloads, never a fixed time, which a busy machine can outrun.
 */
async function storedNotes(page: Page): Promise<{ title: string; hidden: boolean }[]> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const req = indexedDB.open('grim-games-player');
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					if (!db.objectStoreNames.contains('notebooks')) {
						db.close();
						resolve([]);
						return;
					}
					const all = db.transaction('notebooks').objectStore('notebooks').getAll();
					all.onsuccess = () => {
						db.close();
						resolve(
							(all.result as { notes: { title: string; hidden: boolean }[] }[]).flatMap((b) =>
								b.notes.map(({ title, hidden }) => ({ title, hidden }))
							)
						);
					};
				};
			})
	);
}

/** Opens Settings from the menu: Player view has no app header, as the board has none. */
async function openSettings(page: Page) {
	await page.getByRole('button', { name: 'Menu', exact: true }).tap();
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('button', { name: 'Settings' })
		.tap();
}

/** Opens a tab, from the ⋯ menu when it is not on the row (a phone has no room for all). */
async function openTab(page: Page, name: string) {
	const tab = page.getByRole('tab', { name, exact: true });
	await expect(page.getByRole('tab').first()).toBeVisible();
	if (!(await tab.count())) {
		await page.getByRole('button', { name: 'More tabs' }).tap();
		await page.getByRole('dialog', { name: 'More tabs' }).getByRole('button', { name }).tap();
	}
	await tab.tap();
}

/** Lets a sheet's opening animation end, so its size and place are final. */
async function settled(locator: Locator) {
	await locator.evaluate((el) =>
		Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
	);
}

test.beforeEach(async ({ page }) => {
	await page.goto('/play');
	// No script yet: the base three are offered here, since /scripts no longer lists them.
	// The first load fetches the character data, slow on a busy machine.
	await expect(page.getByRole('link', { name: 'Find a script' })).toHaveAttribute(
		'href',
		'/scripts',
		{ timeout: 15_000 }
	);
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap();
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
});

test('the player view is a reading page, with no Storyteller controls', async ({ page }) => {
	// Script, night order, the town and notes only (Trevor, 2026-10-16: "nothing close to ...
	// controls"; 2026-10-19: a Grim tab of what the town knows). The live room is a row over
	// the tabs, not a tab (plan J12).
	const onRow = await page.getByRole('tab').allTextContents();
	const more = page.getByRole('button', { name: 'More tabs' });
	if (await more.count()) {
		await more.tap();
		const menu = page.getByRole('dialog', { name: 'More tabs' });
		onRow.push(
			...(await menu.getByRole('button', { name: /^(?!Close$)/ }).allTextContents()).map((name) =>
				name.trim()
			)
		);
		await page.keyboard.press('Escape');
	}
	expect(onRow).toEqual(['Script', 'Night', 'Grim', 'Notes']);
	await expect(page.getByTestId('seat-ring')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /seat/i })).toHaveCount(0);
});

test('the settings cog opens the one Settings, at its list of sections', async ({ page }) => {
	// Plan E2 (Trevor, 2026-10-26: "easier access to accessibility, zoom, font size for
	// players"), then one Settings everywhere (Trevor, 2026-10-27: "Change your settings into
	// settings"): the cog opens the app's Settings, where Text and Tokens hold every size.
	const cog = page.getByTestId('you-button');
	await expect(cog).toHaveAccessibleName('Settings');
	await cog.tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	const sections = settings.getByRole('navigation', { name: 'Settings sections' });
	await expect(sections).toBeVisible();
	// The root: phones show only the list; wide screens the list beside the first section.
	if (await settings.getByRole('button', { name: 'All settings' }).isHidden())
		await expect(sections.getByRole('button').first()).toHaveAttribute('aria-current', 'page');
	await sections.getByRole('button', { name: 'Text', exact: true }).tap();
	const size = settings.getByRole('slider', { name: 'Text size', exact: true });
	await size.fill('1.25');
	await expect(size).toHaveAttribute('aria-valuetext', '125%');
	expect(
		await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--text-scale')
		)
	).toBe('1.25');
	// Not in a room: Settings > Player has no name to set yet.
	const back = settings.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) await back.tap();
	await sections.getByRole('button', { name: 'Player', exact: true }).tap();
	await expect(settings.getByRole('button', { name: 'Edit your name' })).toHaveCount(0);
	// The sizes live once, in Tokens, not again under Player.
	await expect(settings.getByRole('slider', { name: 'Character token size' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(settings).toBeHidden();
});

test("the script's name never breaks inside a word, beside its logo and buttons", async ({
	page
}) => {
	// It broke as "Troub / le Brewi / ng" on a phone (2026-10-23); it shrinks to fit instead.
	const title = page.getByRole('heading', { name: 'Trouble Brewing', level: 1 });
	const broken = await title.evaluate((el) => {
		const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		let text: Node | null;
		while ((text = walk.nextNode()) && !text.textContent?.includes('Trouble'));
		const words = [...(text?.textContent ?? '').matchAll(/\S+/g)];
		return words.filter((word) => {
			const range = document.createRange();
			range.setStart(text!, word.index);
			range.setEnd(text!, word.index + word[0].length);
			const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
			return tops.size > 1;
		}).length;
	});
	expect(broken).toBe(0);
	// Nothing pushes the page sideways.
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		await page.evaluate(() => document.documentElement.clientWidth)
	);
});

test('tabs that do not fit move into a ⋯ menu instead of wrapping', async ({ page }) => {
	// Trevor, 2026-10-20: on his Pixel the tabs wrapped onto a second line; "triple dot drop
	// down". A narrow screen stands in for a big text size.
	await page.setViewportSize({ width: 260, height: 640 });
	const tabs = page.getByRole('tablist');
	const more = page.getByRole('button', { name: 'More tabs' });
	await expect(more).toBeVisible();
	const tops = await page
		.getByRole('tab')
		.evaluateAll((els) => [
			...new Set(els.map((el) => Math.round(el.getBoundingClientRect().top)))
		]);
	expect(tops).toHaveLength(1);
	expect(await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

	// Picking one from the menu opens it and keeps it on the row.
	await more.tap();
	await page
		.getByRole('dialog', { name: 'More tabs' })
		.getByRole('button', { name: 'Notes' })
		.tap();
	await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('tabpanel', { name: 'Notes' })).toBeVisible();

	// With room again, every tab is back on the row and the ⋯ button goes.
	await page.setViewportSize({ width: 1000, height: 640 });
	await expect(page.getByRole('tab')).toHaveText(['Script', 'Night', 'Grim', 'Notes']);
	await expect(more).toHaveCount(0);
});

test("the player view's menu is the app's, and leaving it asks first", async ({ page }) => {
	// The app pages' hamburger, as no sidebar shows on a phone or tablet (Trevor, 2026-10-24).
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	const title = page.getByRole('heading', { name: 'Trouble Brewing', level: 1 });
	const [m, h] = [(await menu.boundingBox())!, (await title.boundingBox())!];
	// Level with the header's buttons, the title under them (Trevor, 2026-10-26: "move the
	// script name down from the top of player view, still in header area, but lower").
	const cog = (await page.getByTestId('you-button').boundingBox())!;
	expect(Math.abs(m.y - cog.y)).toBeLessThan(m.height / 2);
	expect(h.y).toBeGreaterThanOrEqual(m.y + m.height - 1);

	await menu.tap();
	const drawer = page.getByRole('dialog', { name: APP_NAME });
	await drawer.getByRole('link', { name: 'Library', exact: true }).tap();
	const ask = page.getByRole('alertdialog', { name: 'Leave the script?' });
	await expect(ask).toBeVisible();
	await expect(ask).toContainText('Your notes, scratch pads and guesses stay on this device.');
	await ask.getByRole('button', { name: 'Cancel' }).tap();
	await expect(page).toHaveURL(/\/play$/);

	// Join game is still the player view, so it doesn't ask.
	await menu.tap();
	await drawer.getByRole('link', { name: 'Continue game' }).tap();
	await expect(page).toHaveURL(/\/join$/);
	await expect(ask).toHaveCount(0);

	// Join game shows none of the phone's script (plan J1), so leaving it has nothing to ask.
	await expect(page.getByRole('heading', { name: 'Continue game', level: 1 })).toBeVisible();
	await menu.tap();
	await drawer.getByRole('link', { name: 'Library', exact: true }).tap();
	await expect(page).toHaveURL(/\/library$/);
	await expect(ask).toHaveCount(0);

	// From the script itself it asks, and Confirm leaves.
	await page.goto('/play');
	await menu.tap();
	await drawer.getByRole('link', { name: 'Library', exact: true }).tap();
	await ask.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page).toHaveURL(/\/library$/);
});

test('notes written on a seat by an older version are kept as titled notes', async ({ page }) => {
	// A v4 notebook from when /play had a seat circle (notebook.ts migrateNotebook). The
	// notebook's database opens with the Notes tab, so open it once first.
	await page.getByRole('tab', { name: 'Notes' }).tap();
	// A new notebook starts with no notes, only "+ New note" (Trevor, 2026-10-29).
	await expect(page.locator('[data-note]')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'New note' })).toBeVisible();
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
	// No "* Not the first night" footnote (Trevor, 2026-10-18).
	await expect(page.getByText('Not the first night')).toHaveCount(0);
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
	// The chosen total is gold, its counts below red, and lines part the counts (Trevor,
	// 2026-10-18).
	const look = await panel
		.locator('td[data-current]')
		.first()
		.evaluate((td) => {
			const colour = (value: string) => {
				const probe = document.createElement('div');
				probe.style.color = value;
				td.append(probe);
				const c = getComputedStyle(probe).color;
				probe.remove();
				return c;
			};
			const total = td.closest('table')!.querySelector('thead th[data-current]')!;
			return {
				gold: colour('var(--heading)'),
				red: colour('var(--accent)'),
				total: getComputedStyle(total).backgroundColor,
				count: getComputedStyle(td).backgroundColor,
				column: getComputedStyle(td).borderInlineStartStyle,
				counts: getComputedStyle(total).borderBottomStyle
			};
		});
	expect(look.total).toBe(look.gold);
	expect(look.count).toBe(look.red);
	expect([look.column, look.counts]).toEqual(['solid', 'solid']);
	await page.reload();
	await expect(seven).toHaveAttribute('aria-pressed', 'true');
	await seven.tap();
	await expect(seven).toHaveAttribute('aria-pressed', 'false');
	await expect(panel.locator('td[data-current]')).toHaveCount(0);
	// Anywhere in a column picks it, not just its number (Trevor, 2026-10-17).
	await panel.locator('tbody tr[data-type="minion"] td').nth(2).tap();
	await expect(seven).toHaveAttribute('aria-pressed', 'true');
});

test('First night and Other nights each close from their header, remembered', async ({ page }) => {
	// Trevor, 2026-10-19: both nights collapsible.
	await page.getByRole('tab', { name: 'Night', exact: true }).tap();
	const first = page.getByRole('button', { name: 'First night' });
	const other = page.getByRole('button', { name: 'Other nights' });
	await expect(first).toHaveAttribute('aria-expanded', 'true');
	await expect(other).toHaveAttribute('aria-expanded', 'true');
	// A closed section shows how many it holds (Trevor, 2026-10-19): here, who wakes.
	const waking = await page.locator('section[data-night="first"] li:has(button.name)').count();
	expect(waking).toBeGreaterThan(0);
	await expect(first.getByTestId('section-count')).toHaveCount(0);
	await first.tap();
	await expect(first).toHaveAttribute('aria-expanded', 'false');
	await expect(first.getByTestId('section-count')).toHaveText(String(waking));
	await expect(page.locator('section[data-night="first"] li[data-step="poisoner"]')).toBeHidden();
	await expect(page.locator('section[data-night="other"] li[data-step="poisoner"]')).toBeVisible();
	await page.reload();
	await page.getByRole('tab', { name: 'Night', exact: true }).tap();
	await expect(first).toHaveAttribute('aria-expanded', 'false');
	await expect(other).toHaveAttribute('aria-expanded', 'true');
});

test("the night order shows who wakes, with TPI's night text", async ({ page }) => {
	await page.getByRole('tab', { name: 'Night', exact: true }).tap();
	const first = page.locator('section[data-night="first"]');
	// Dusk, Minion info, Demon info and Dawn show their own icons (Trevor, 2026-10-16); Minion
	// info and Demon info are a red M and D (Trevor, 2026-10-28).
	const minionInfo = first.locator('li[data-step="minioninfo"]');
	await expect(minionInfo).toContainText('Minion info');
	await expect(minionInfo.locator('.token[data-marker="minioninfo"]')).toBeVisible();
	await expect(minionInfo.locator('.token[data-marker="minioninfo"] text')).toHaveText('M');
	await expect(first.locator('.token[data-marker="demoninfo"] text')).toHaveText('D');
	// Each says what happens there, as the Storyteller's night step does (Trevor, 2026-10-28).
	await expect(minionInfo.locator('.text')).toContainText('Wake the Minions');
	await expect(first.locator('li[data-step="demoninfo"] .text')).toContainText('Wake the Demon');
	const poisoner = first.locator('li[data-step="poisoner"]');
	// Every step's number sits level with the middle of its icon, however long the text, and
	// a line runs between steps (Trevor, 2026-10-19).
	for (const step of [minionInfo, poisoner]) {
		const num = (await step.locator(':scope > .num').boundingBox())!;
		const icon = (await step.locator(':scope > .icon').boundingBox())!;
		expect(Math.abs(num.y + num.height / 2 - (icon.y + icon.height / 2))).toBeLessThan(1);
	}
	expect(await poisoner.evaluate((li) => getComputedStyle(li).borderTopStyle)).toBe('solid');
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
	// A new note closed with nothing in it is not kept.
	await page.getByRole('button', { name: 'New note' }).tap();
	await expect(page.getByRole('dialog', { name: 'Note' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Note' })).toBeHidden();
	await expect(page.locator('[data-note]')).toHaveCount(0);
	await page.getByRole('button', { name: 'New note' }).tap();
	let sheet = page.getByRole('dialog', { name: 'Note' });
	// Opening a note doesn't focus a field, so the phone keyboard stays closed (Trevor).
	await expect(sheet.getByRole('textbox', { name: 'Title' })).toBeVisible();
	await expect(sheet.getByRole('textbox', { name: 'Title' })).not.toBeFocused();
	await expect(sheet.getByRole('textbox', { name: 'Text' })).not.toBeFocused();
	await sheet.getByRole('textbox', { name: 'Title' }).fill('What I really know');
	await sheet.getByRole('textbox', { name: 'Text' }).fill('Sam is the Imp');
	await page.keyboard.press('Escape');

	// New ones start from a dashed card at the end of each list, not a header button (Trevor,
	// 2026-10-24).
	await expect(
		page.locator('[data-note]').last().locator('xpath=../following-sibling::li')
	).toHaveCount(1);
	await expect(page.getByTestId('new-note')).toHaveCSS('border-style', 'dashed');
	await expect(page.getByTestId('new-pad')).toHaveCSS('border-style', 'dashed');
	await expect(page.getByRole('button', { name: 'New note' })).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'New pad' })).toHaveCount(1);
	await page.getByRole('button', { name: 'New note' }).tap();
	sheet = page.getByRole('dialog', { name: 'Note' });
	await sheet.getByRole('textbox', { name: 'Title' }).fill('My bluff');
	await sheet.getByRole('textbox', { name: 'Text' }).fill('Chef: 0');
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-note]')).toHaveCount(2);

	await expect
		.poll(async () => (await storedNotes(page)).map((n) => n.title))
		.toEqual(['What I really know', 'My bluff']);
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
	// In the header, beside its X (Trevor, 2026-10-17).
	await expect(sheet.locator('.head').getByRole('button', { name: 'Delete note' })).toBeVisible();
	// The panel grows in: measured mid-animation the button is a hair under 44.
	await settled(sheet);
	const box = (await del.boundingBox())!;
	expect(box.width).toBeGreaterThanOrEqual(44);
	expect(box.height).toBeGreaterThanOrEqual(44);
	const colours = await del.evaluate((el) => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--evil-text)';
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
	await page.getByRole('button', { name: 'New note' }).tap();
	await page
		.getByRole('dialog', { name: 'Note' })
		.getByRole('textbox', { name: 'Title' })
		.fill('TB');
	await page.keyboard.press('Escape');
	await expect.poll(async () => (await storedNotes(page)).map((n) => n.title)).toEqual(['TB']);

	// Players have no Change script button (Trevor): the script comes from /scripts or a link.
	await expect(page.getByRole('link', { name: 'Change script' })).toHaveCount(0);
	await page.goto(`/play#e=bmr`);
	await expect(page.getByRole('heading', { name: 'Bad Moon Rising', level: 1 })).toBeVisible();
	// A new script starts its own notebook, with no notes; Trouble Brewing's is kept.
	await expect(page.getByRole('button', { name: 'New note' })).toBeVisible();
	await expect(page.locator('[data-note]')).toHaveCount(0);
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
	// Print and Share sit on one line above the title, phones included (Trevor, 2026-10-19;
	// the title moved under them 2026-10-26).
	const title = await page.getByRole('heading', { name: 'Code Night', level: 1 }).boundingBox();
	for (const name of ['Print script', 'Share script']) {
		const icon = await page.getByRole('button', { name }).boundingBox();
		expect(icon!.y + icon!.height).toBeLessThanOrEqual(title!.y + 1);
	}
	await page.getByRole('button', { name: 'Share script' }).tap();
	const qr = page.getByRole('dialog', { name: 'Share', exact: true });
	await expect(qr.getByTestId('share-url')).toHaveValue(/\/play#c=\d{6}$/);
	await expect(qr.getByTestId('share-digits')).toHaveCount(0);
	await expect(qr.getByTestId('script-byline')).toHaveCount(0);
});

test('the share screen names the script, its author and its version', async ({ page }) => {
	const shared = [
		{ id: '_meta', name: 'Signed Night', author: 'Trevor', version: '1.2' },
		'chef',
		'imp'
	];
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	await page.getByRole('button', { name: 'Share script' }).tap();
	// Trevor, 2026-10-18: name, author and version (when there is one) on the share screen.
	// Titled just "Share", with the script's name under it as /play's header has it (Trevor,
	// 2026-10-27).
	const dialog = page.getByRole('dialog', { name: 'Share', exact: true });
	await expect(dialog.getByRole('heading', { name: 'Signed Night', level: 3 })).toBeVisible();
	await expect(dialog.getByTestId('script-byline')).toHaveText('by Trevor · v1.2');
});

test('a shared link with problems opens the Script check first', async ({ page }) => {
	const shared = [{ id: '_meta', name: 'Typo Script' }, 'chef', 'fortune_teler', 'imp'];
	await page.goto('/');
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);
	const check = page.getByRole('dialog', { name: 'Script check' });
	await expect(check).toContainText('Did you mean Fortune Teller');
	await check.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('heading', { name: 'Typo Script', level: 1 })).toBeVisible();
	await expect(page.locator('[data-character]')).toHaveCount(2);
});

test('each note can hide its contents until it is opened', async ({ page }) => {
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: 'New note' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Note' });
	await sheet.getByRole('textbox', { name: 'Title' }).fill('Evil team');
	await sheet.getByRole('textbox', { name: 'Text' }).fill('Sam is the Imp');
	await page.keyboard.press('Escape');
	const row = page.locator('[data-note]');
	await expect(row).toContainText('Sam is the Imp');

	// Each note has its own switch (Trevor, 2026-10-17), not a setting, and it is the same
	// one as a scratch pad's, beside the title (Trevor, 2026-10-18).
	await row.tap();
	const hide = sheet.getByRole('button', { name: 'Hide contents' });
	await expect(hide).toHaveAttribute('aria-pressed', 'false');
	await hide.tap();
	await expect(hide).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Escape');

	// The title stays so notes can be found; the text is hidden (Trevor, 2026-10-16).
	await expect(row).toHaveText(/^\s*Evil team\s*Hidden\s*$/);
	await expect(row).not.toContainText('Sam is the Imp');
	// Opening the note shows it.
	await row.tap();
	await expect(sheet.getByRole('textbox', { name: 'Text' })).toHaveValue('Sam is the Imp');
	await page.keyboard.press('Escape');
	// Kept after a reload.
	await expect.poll(() => storedNotes(page)).toEqual([{ title: 'Evil team', hidden: true }]);
	await page.reload();
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await expect(page.locator('[data-note]')).toHaveText(/^\s*Evil team\s*Hidden\s*$/);
	// The old Settings switch is gone.
	await openSettings(page);
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Player', exact: true })
		.tap();
	await expect(settings.getByText('Hide note contents')).toHaveCount(0);
});

test('Enter in a note title closes the keyboard', async ({ page }) => {
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: 'New note' }).tap();
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

test('a script character is its icon in a ring, with its name on a band out of the ring’s top', async ({
	page
}) => {
	// Trevor, 2026-10-28: the icons were "kind of hidden"; a ring of the alignment's colour, a
	// band of it across the row with the name, the ability under the band.
	const chef = page.locator('[data-character="chef"]');
	const ring = chef.locator('.ring');
	const band = chef.locator('.band');
	await expect(band).toContainText('Chef');
	await expect(ring.locator('img')).toBeVisible();
	const [r, b] = [(await ring.boundingBox())!, (await band.boundingBox())!];
	expect(r.height).toBeGreaterThanOrEqual(44);
	expect(Math.abs(b.y - r.y)).toBeLessThan(1);
	expect(b.x + b.width).toBeGreaterThan(r.x + r.width * 2);
	const colours = async (row: typeof chef) => ({
		ring: await row.locator('.ring').evaluate((el) => getComputedStyle(el).borderTopColor),
		band: await row.locator('.band').evaluate((el) => getComputedStyle(el).backgroundColor)
	});
	const good = await colours(chef);
	expect(good.ring).toBe(good.band);
	const evil = await colours(page.locator('[data-character="imp"]'));
	expect(evil.ring).toBe(evil.band);
	expect(evil.ring).not.toBe(good.ring);
	await ring.tap();
	await expect(page.getByRole('dialog', { name: 'Chef' })).toBeVisible();
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
	// A faint line under each jinx (Trevor, 2026-10-18).
	const line = await dialog
		.locator('li')
		.first()
		.evaluate((li) => getComputedStyle(li).borderBottomStyle);
	expect(line).toBe('solid');
});

test('the title line’s sheet background, Print, Share and settings cog are one kind of button', async ({
	page
}) => {
	// Trevor, 2026-10-26: the paint bucket "should be the same as other buttons it is in the same
	// line as"; then "Settings cog should be like other buttons for players".
	const row = page.getByRole('banner').or(page.locator('header')).first();
	await expectMatchingIconRow(row, [
		'Sheet background',
		'Print script',
		'Share script',
		'Settings'
	]);
	// The script's name sits under them, clear of the buttons and the hamburger (Trevor,
	// 2026-10-26: "move the script name down from the top of player view").
	const cog = (await row.getByTestId('you-button').boundingBox())!;
	const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
	expect(title.y).toBeGreaterThanOrEqual(cog.y + cog.height - 1);
});

test('the Script sheet is always Normal on screen, with no layout setting', async ({ page }) => {
	// Trevor, 2026-10-27: "Compact and super compact modes suck. Remove for now". A phone that
	// picked one before goes back to Normal; printing still fits a page its own way.
	await page.evaluate(() =>
		localStorage.setItem('grim-games:player-settings:v1', JSON.stringify({ density: 'super' }))
	);
	await page.reload();
	await expect(page.locator('[data-density="normal"]')).toBeVisible();
	await expect(page.locator('[data-density="super"]')).toHaveCount(0);
	const settings = await openPlayerSettings(page);
	await expect(settings.getByRole('combobox', { name: 'Script sheet layout' })).toHaveCount(0);
	await expect(settings.getByRole('combobox', { name: 'Sheet background' })).toBeVisible();
	await expect(settings.getByRole('combobox', { name: 'Script sheet layout' })).toHaveCount(0);
});

test('the sheet background colours the whole player screen, its dialogs included', async ({
	page
}) => {
	const page_ = page.locator('html');
	await expect(page_).toHaveCSS('background-color', 'rgb(20, 11, 11)');
	await openSettings(page);
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Player', exact: true })
		.tap();
	await settings.getByRole('combobox', { name: 'Sheet background' }).tap();
	await page.getByRole('option', { name: 'Off-white', exact: true }).tap();
	// Settings, a dialog over the player screen, follows at once (Trevor, 2026-10-25).
	await expect(settings).toHaveCSS('color', 'rgb(27, 27, 27)');
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(page_).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#ffffff');
	await page.reload();
	await expect(page_).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	// Other screens keep the app theme.
	await page.goto('/about');
	await expect(page_).toHaveCSS('background-color', 'rgb(20, 11, 11)');
	// Continue game too, until a game is open (Trevor, 2026-10-28).
	await page.goto('/join');
	await expect(page.getByRole('heading', { name: 'Continue game', level: 1 })).toBeVisible();
	await expect(page_).toHaveCSS('background-color', 'rgb(20, 11, 11)');
});

test('the room this phone joined is one row over the tabs, and Share hands it on', async ({
	page,
	browser
}, testInfo) => {
	// Plan J12 (Trevor, 2026-10-23): no Room tab. Before joining, /play has no room row.
	await expect(page.getByRole('tab', { name: 'Room' })).toHaveCount(0);
	await expect(page.getByTestId('you-row')).toHaveCount(0);

	// The Storyteller opens a room on another device.
	const st = await (await browser.newContext({ ...testInfo.project.use })).newPage();
	await st.goto('/new');
	await st
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await st.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(st);
	await st.goto(`${new URL(st.url()).pathname}/room`);
	await expect(st.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	await expect(st.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const shown = (await st.getByTestId('share-code').textContent())!;
	const code = shown.replace(/\s/g, '');

	// Joining lands on the script, with the room's row over the tabs; You on the title line
	// takes a name (plan E2).
	await page.goto(`/join/${code}`);
	const row = page.getByTestId('you-row');
	await expect(page.getByTestId('join-status')).toHaveText('');
	// No "set your name" box at the top, not even before a name (Trevor, 2026-10-27: "I just
	// want that whole thing gone").
	await expect(row).toBeHidden();
	await expect(page.getByRole('tab', { name: 'Script' })).toHaveAttribute('aria-selected', 'true');
	const sheet = await openProfile(page);
	// The name has its own modal with Save; Settings' other rows change at once (Trevor,
	// 2026-10-27).
	await expect(sheet.getByRole('button', { name: 'Save' })).toHaveCount(0);
	await setPlayerName(page, 'Alex');
	await expect(sheet.getByTestId('player-name')).toHaveText('Alex');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(page.getByTestId('join-status')).toHaveText('');
	// The cog at the top is named for it (plan E2), and the empty room box leaves the row
	// (Trevor, 2026-10-26: "remove the empty space next to the game state tracker").
	await expect(page.getByRole('button', { name: 'Settings: Alex' })).toBeVisible();
	await expect(row).toBeHidden();

	// The cog stays at the top of every tab.
	await openTab(page, 'Notes');
	await expect(page.getByRole('button', { name: 'Settings: Alex' })).toBeVisible();

	// Share script hands on the room's link and code (plan J20).
	await page.getByRole('button', { name: 'Share script' }).tap();
	const share = page.getByRole('dialog', { name: 'Share', exact: true });
	await expect(share.getByTestId('share-code')).toHaveText(shown);
	// The logo in the QR code's middle, and beside the name under the title (Trevor, 2026-10-27).
	await expect(share.getByTestId('script-logo')).toHaveCount(2);
	for (const logo of await share.getByTestId('script-logo').all())
		await expect(logo).toHaveAttribute('data-logo', '/data/logos/tb.webp');
	await expect(share.getByTestId('share-script')).toContainText('Trouble Brewing');
	await expect(share.getByTestId('share-url')).toHaveValue(new RegExp(`/join#${code}$`));
	await share.getByRole('button', { name: 'Close' }).tap();

	// /play itself shows the same room, while the phone is in it.
	await page.goto('/play');
	await expect(page.getByTestId('join-status')).toHaveText('');
	await expect(page.getByRole('button', { name: 'Settings: Alex' })).toBeVisible();
	await st.context().close();
});
