import { expect, test, type Page } from '@playwright/test';

/** Selects `word` inside the card editor, as a Storyteller's drag would. */
async function select(page: Page, word: string) {
	await page.getByRole('textbox', { name: 'Text' }).evaluate((el, word) => {
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const at = node.textContent?.indexOf(word) ?? -1;
			if (at < 0) continue;
			const range = document.createRange();
			range.setStart(node, at);
			range.setEnd(node, at + word.length);
			document.getSelection()!.removeAllRanges();
			document.getSelection()!.addRange(range);
			return;
		}
	}, word);
}

/** The colours open from the Colour button, beside Bold, Italic and Underline (Trevor, 2026-10-18). */
async function ink(page: Page, colour: string) {
	await page.getByRole('button', { name: 'Colour', exact: true }).tap();
	await page.getByRole('button', { name: colour, exact: true }).tap();
}

async function characterCount(page: Page, count: 'None' | 'Exactly' | 'Range') {
	await page.getByRole('combobox', { name: 'Characters to show' }).tap();
	await page.getByRole('option', { name: count, exact: true }).tap();
}

async function newCard(page: Page, text: string) {
	await page.getByRole('button', { name: 'New info token' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill(text);
}

test('Bold, Italic, Underline and Colour each apply at once, in the editor, preview and tile', async ({
	page
}) => {
	await page.goto('/info-tokens');
	await newCard(page, 'You are cursed today');
	const field = page.getByRole('textbox', { name: 'Text' });
	const preview = page.getByRole('figure', { name: 'Preview' });
	// The preview follows the typing.
	await expect(preview).toContainText('You are cursed today');

	await select(page, 'cursed');
	await page.getByRole('button', { name: 'Bold' }).tap();
	// Bold is weight, not colour (Trevor, 2026-10-16).
	const boldWord = field.locator('b, strong').filter({ hasText: 'cursed' });
	await expect(boldWord).toHaveCSS('font-weight', '900');
	const plainColour = await field.evaluate((el) => getComputedStyle(el).color);
	await expect(boldWord).toHaveCSS('color', plainColour);
	await expect(preview.locator('strong')).toHaveText('cursed');

	await select(page, 'today');
	await page.getByRole('button', { name: 'Italic' }).tap();
	await expect(preview.locator('em')).toHaveText('today');

	await select(page, 'are');
	await page.getByRole('button', { name: 'Underline' }).tap();
	await expect(preview.locator('u')).toHaveText('are');

	await select(page, 'You');
	await ink(page, 'Red');
	await expect(preview.locator('[data-ink="red"]')).toHaveText('You');
	// Reopened, the colours show the one at the caret.
	await page.getByRole('button', { name: 'Colour', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Red', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('button', { name: 'Red', exact: true }).tap();

	await page.getByRole('button', { name: 'Confirm' }).tap();
	const tile = page.getByRole('button', { name: 'You are cursed today', exact: true });
	await expect(tile.locator('strong')).toHaveText('cursed');
	await expect(tile.locator('em')).toHaveText('today');
	await expect(tile.locator('[data-ink="red"]')).toHaveText('You');
	await expect(tile.locator('u')).toHaveText('are');
});

test('a card saved before colours keeps its red words as red, not bold', async ({ page }) => {
	await page.goto('/info-tokens');
	await page.evaluate(() =>
		localStorage.setItem(
			'grim-games:info-tokens',
			JSON.stringify({ version: 1, custom: [{ id: 'old', text: 'You are **mad**' }] })
		)
	);
	await page.reload();
	const tile = page.getByRole('button', { name: 'You are mad', exact: true });
	await expect(tile.locator('[data-ink="red"]')).toHaveText('mad');
	await expect(tile.locator('strong')).toHaveCount(0);
});

test('a card that belongs to a character sits under Character-Specific', async ({ page }) => {
	await page.goto('/info-tokens');
	await newCard(page, 'You feel uneasy');
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('button', { name: 'Choose' }).tap();
	await dialog.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await dialog
		.getByRole('button', { name: /^Empath/ })
		.first()
		.tap();
	await dialog.getByRole('button', { name: 'Done' }).tap();
	await expect(dialog.getByText('Empath')).toBeVisible();
	await dialog.getByRole('button', { name: 'Confirm' }).tap();

	const tile = page.getByRole('button', { name: /^You feel uneasy/ });
	await expect(tile).toContainText('Empath');
	// Listed with the character cards, not with the other custom cards.
	await expect(
		page
			.locator('.collapsible', { hasText: 'Character-Specific' })
			.getByRole('button', { name: /^You feel uneasy/ })
	).toBeVisible();
});

test('in a game, a character card is offered only while its character is in play', async ({
	page
}) => {
	await page.goto('/info-tokens');
	await page.evaluate(() =>
		localStorage.setItem(
			'grim-games:info-tokens',
			JSON.stringify({
				version: 2,
				custom: [
					{ id: 'a', text: 'Empath card', characterIds: ['empath'] },
					{ id: 'b', text: 'Chef card', characterIds: ['chef'] }
				]
			})
		)
	);
	await page.goto('/spikes/info-tokens');
	await page.getByRole('button', { name: 'Info tokens (Empath in play)' }).tap();
	await expect(page.getByRole('button', { name: /^Empath card/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Chef card/ })).toHaveCount(0);
});

/** Picks what a new card asks to fill in. */
async function fillIn(page: Page, kind: string) {
	await page.getByRole('combobox', { name: 'Fill in' }).tap();
	await page.getByRole('option', { name: kind, exact: true }).tap();
}

test('a fill-in card asks for its word each time and shows it', async ({ page }) => {
	await page.goto('/info-tokens');
	await newCard(page, 'Your score is');
	await fillIn(page, 'Words');
	await expect(page.getByRole('figure', { name: 'Preview' })).toContainText('…');
	await page.getByRole('button', { name: 'Confirm' }).tap();

	await page.getByRole('button', { name: 'Your score is', exact: true }).tap();
	await page.getByRole('textbox', { name: 'Fill in' }).fill('42');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const shown = page.getByTestId('show-to-player');
	await expect(shown.getByRole('heading')).toHaveText('Your score is');
	await expect(shown).toContainText('42');
});

test('each tile says what it will ask for before it is tapped', async ({ page }) => {
	await page.goto('/info-tokens');
	// Icons, each named by its words (Trevor, 2026-10-18), the quick card marked apart.
	const asks = (name: string) =>
		page
			.locator('ul.cards')
			.getByRole('button', { name, exact: true })
			.getByTestId('info-token-asks');
	// Always the three bluffs (Trevor, 2026-10-18).
	await expect(asks('These characters are not in play')).toHaveText('3');
	await expect(asks('These characters are not in play').getByRole('img')).toHaveAccessibleName(
		'Asks for 3 characters'
	);
	await expect(asks('You are').getByRole('img')).toHaveAccessibleName('Asks for 1 character');
	// At least one, up to three (Trevor, 2026-10-18).
	await expect(asks('This player is')).toHaveText('1–3');
	await expect(asks('This player is').getByRole('img')).toHaveAccessibleName(
		'Asks for 1 to 3 characters'
	);
	await expect(asks('Your number is').getByRole('img')).toHaveAccessibleName(
		'Asks for a number from 0'
	);
	await expect(asks('Yes/No').getByRole('img')).toHaveAccessibleName('Asks for one of: Yes, No');
	await expect(asks('This is the Demon')).toHaveCount(0);
	await expect(asks('Quick card').getByRole('img')).toHaveCount(2);
	await expect(asks('Quick card').getByRole('img').first()).toHaveAccessibleName(
		'Used once, never saved'
	);
});

test("a custom card's answers, number range and characters are each set on their own", async ({
	page
}) => {
	await page.goto('/info-tokens');
	await newCard(page, 'Your colour is');
	await fillIn(page, 'Choices');
	await page.getByRole('textbox', { name: 'Answer 1' }).fill('Red');
	await page.getByRole('textbox', { name: 'Answer 2' }).fill('Blue');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const tile = page.getByRole('button', { name: 'Your colour is', exact: true });
	await expect(tile.getByRole('img')).toHaveAccessibleName('Asks for one of: Red, Blue');
	await tile.tap();
	await page.getByRole('combobox', { name: 'Answer' }).tap();
	await page.getByRole('option', { name: 'Blue', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.locator('.detail')).toHaveText('Blue');
	await shown.getByRole('button', { name: 'Close' }).tap();

	await newCard(page, 'You saw this many');
	await fillIn(page, 'Number');
	// Numbers only: letters typed are dropped (Trevor, 2026-10-18).
	await page.getByRole('textbox', { name: 'Lowest' }).pressSequentially('a1b');
	await expect(page.getByRole('textbox', { name: 'Lowest' })).toHaveValue('1');
	await page.getByRole('textbox', { name: 'Highest' }).fill('3');
	// A range of characters: from 1 to 2 (Trevor, 2026-10-18: exact, or range).
	await characterCount(page, 'Range');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const counted = page.getByRole('button', { name: 'You saw this many', exact: true });
	await expect(counted.getByRole('img').first()).toHaveAccessibleName(
		'Asks for a number from 1 to 3'
	);
	await expect(counted.getByRole('img').last()).toHaveAccessibleName('Asks for 1 to 2 characters');
	// Saved and read back the same after a reload.
	await page.reload();
	await expect(counted.getByRole('img')).toHaveCount(2);
	await page.getByRole('button', { name: 'Edit You saw this many' }).tap();
	await expect(page.getByRole('textbox', { name: 'Highest' })).toHaveValue('3');
});

test('a saved colour can be changed and cleared, with bold kept', async ({ page }) => {
	await page.goto('/info-tokens');
	await page.evaluate(() =>
		localStorage.setItem(
			'grim-games:info-tokens',
			JSON.stringify({
				version: 2,
				custom: [{ id: 'a', text: 'You are [red]**very** mad[/red] today' }]
			})
		)
	);
	await page.reload();
	await page.getByRole('button', { name: 'Edit You are very mad today' }).tap();
	const preview = page.getByRole('figure', { name: 'Preview' });

	// Change part of the red words to blue.
	await select(page, 'mad');
	await ink(page, 'Blue');
	await expect(preview.locator('[data-ink="blue"]')).toHaveText('mad');
	await expect(preview.locator('[data-ink="red"]')).toHaveText('very ');

	// Clear the colour from the bold word; it stays bold.
	await select(page, 'very');
	await ink(page, 'Text colour');
	await expect(preview.locator('[data-ink="red"]')).toHaveCount(0);
	await expect(preview.locator('strong')).toHaveText('very');

	await page.getByRole('button', { name: 'Confirm' }).tap();
	const tile = page.getByRole('button', { name: 'You are very mad today', exact: true });
	await expect(tile.locator('[data-ink="blue"]')).toHaveText('mad');
	await expect(tile.locator('[data-ink="red"]')).toHaveCount(0);
	await expect(tile.locator('strong')).toHaveText('very');

	// Reopened, the field shows what was saved, and recolouring again works.
	await page.getByRole('button', { name: 'Edit You are very mad today' }).tap();
	await select(page, 'mad');
	await ink(page, 'Green');
	await expect(preview.locator('[data-ink="green"]')).toHaveText('mad');
	await expect(preview.locator('[data-ink="blue"]')).toHaveCount(0);
});

test("Trevor's Enhanced tokens sit apart, and the number can be stepped or typed", async ({
	page
}) => {
	await page.goto('/info-tokens');
	const enhanced = page
		.locator('section.collapsible')
		.filter({ has: page.getByRole('heading', { name: 'Enhanced' }) });
	for (const name of [
		'Your number is',
		'Yes/No',
		'True/False',
		'What are you bluffing?',
		'Use your ability?',
		'Select a player',
		'Select a character',
		'Please choose again',
		'Are you sure?'
	])
		await expect(enhanced.getByRole('button', { name, exact: true })).toBeVisible();
	const shown = page.locator('[data-testid="show-to-player"][open]');

	await enhanced.getByRole('button', { name: 'Your number is', exact: true }).tap();
	// The dialog takes the token's own name (Trevor, 2026-10-18).
	await expect(page.getByRole('dialog', { name: 'Your number is' })).toBeVisible();
	await page.getByRole('button', { name: 'Higher number' }).tap();
	await page.getByRole('button', { name: 'Higher number' }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(shown.locator('h2.title')).toHaveText('Your number is');
	await expect(shown.locator('.detail')).toHaveText('2');
	await shown.getByRole('button', { name: 'Close' }).tap();

	// Typed, with Enter showing it (Trevor, 2026-10-18).
	await enhanced.getByRole('button', { name: 'Your number is', exact: true }).tap();
	const field = page.getByRole('textbox', { name: 'Your number is' });
	await field.fill('12');
	// Letters are dropped as they are typed (Trevor, 2026-10-18).
	await field.pressSequentially('x');
	await expect(field).toHaveValue('12');
	await field.press('Enter');
	await expect(shown.locator('.detail')).toHaveText('12');
	await shown.getByRole('button', { name: 'Close' }).tap();

	await enhanced.getByRole('button', { name: 'Yes/No', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Yes/No' })).toBeVisible();
	await page.getByRole('combobox', { name: 'Answer' }).tap();
	await page.getByRole('option', { name: 'No', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(shown.locator('.detail')).toHaveText('No');
	await expect(shown.locator('h2.title')).toHaveCount(0);
	await shown.getByRole('button', { name: 'Close' }).tap();

	// Short answers fill the screen on one line, the longest too (Trevor, 2026-10-30).
	await enhanced.getByRole('button', { name: 'True/False', exact: true }).tap();
	await page.getByRole('combobox', { name: 'Answer' }).tap();
	await page.getByRole('option', { name: 'False', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const answer = shown.locator('.detail');
	await expect(answer).toHaveText('False');
	const view = page.viewportSize()!;
	const box = (await answer.boundingBox())!;
	const lineHeight = await answer.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
	expect(box.height).toBeLessThan(lineHeight * 1.5);
	expect(box.width).toBeGreaterThan(view.width * 0.5);
	expect(box.x + box.width).toBeLessThanOrEqual(view.width);
});

test('a quick card is shown once and never saved', async ({ page }) => {
	await page.goto('/info-tokens');
	// In a section of its own, not among the saved cards (Trevor, 2026-10-18).
	const own = page
		.locator('section.collapsible')
		.filter({ has: page.getByRole('heading', { name: 'Quick card' }) });
	const custom = page
		.locator('section.collapsible')
		.filter({ has: page.getByRole('heading', { name: 'Custom' }) });
	await expect(custom.locator('ul.cards').getByRole('button', { name: 'Quick card' })).toHaveCount(
		0
	);
	await own.locator('ul.cards').getByRole('button', { name: 'Quick card', exact: true }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You may not speak');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading')).toHaveText('You may not speak');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('button', { name: 'You may not speak', exact: true })).toHaveCount(0);
	expect(
		await page.evaluate(() => localStorage.getItem('grim-games:info-tokens') ?? '')
	).not.toContain('You may not speak');
});

test('the Info tokens page shows several cards together, like the board sheet', async ({
	page
}) => {
	await page.goto('/info-tokens');
	// Each card's + adds it; then all are shown in order (Trevor, 2026-10-18).
	await page.getByRole('button', { name: 'Add This is the Demon to the cards to show' }).tap();
	await page.getByRole('button', { name: 'Add You are to the cards to show' }).tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await page.getByRole('button', { name: 'Empath', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const list = page.getByTestId('chain-list');
	await expect(list.getByRole('listitem')).toHaveCount(2);
	await expect(list.getByRole('listitem').last()).toContainText('2. You are');
	await page.getByRole('button', { name: 'Show 2 cards' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading').first()).toHaveText('This is the Demon');
});

test('a custom card can do what the built-in ones do: exactly, not in play, answer only', async ({
	page
}) => {
	await page.goto('/info-tokens');
	// Like "These characters are not in play" (Trevor, 2026-10-18).
	await newCard(page, 'Your bluffs are');
	await characterCount(page, 'Exactly');
	for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More characters' }).tap();
	await page.getByText('Only characters not in play').tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const bluffs = page.getByRole('button', { name: 'Your bluffs are', exact: true });
	await expect(bluffs.getByTestId('info-token-asks')).toHaveText('3');
	await bluffs.tap();
	await expect(page.getByRole('button', { name: 'Random', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Cancel' }).tap();

	// Like Yes/No: only the answer is shown.
	await newCard(page, 'Heads or tails');
	await fillIn(page, 'Choices');
	await page.getByRole('textbox', { name: 'Answer 1' }).fill('Heads');
	await page.getByRole('textbox', { name: 'Answer 2' }).fill('Tails');
	await page.getByText('Show only the answer').tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await page.getByRole('button', { name: 'Heads or tails', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.locator('.detail')).toHaveText('Heads');
	await expect(shown.locator('h2.title')).toHaveCount(0);
});

test('a range of characters can start above one, and is kept', async ({ page }) => {
	await page.goto('/info-tokens');
	await newCard(page, 'Two of these are');
	await characterCount(page, 'Range');
	// From 1 to 2; raise the most to 4, then the least to 2.
	for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More characters' }).tap();
	await page.getByRole('button', { name: 'Higher From' }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const tile = page.getByRole('button', { name: 'Two of these are', exact: true });
	await expect(tile.getByRole('img')).toHaveAccessibleName('Asks for 2 to 4 characters');
	await page.reload();
	await page.getByRole('button', { name: 'Edit Two of these are' }).tap();
	await expect(page.getByRole('combobox', { name: 'Characters to show' })).toContainText('Range');
	await expect(page.getByLabel('From', { exact: true })).toHaveText('2');
	await expect(page.getByLabel('To', { exact: true })).toHaveText('4');
});

test("the example card fills its box, and the page doesn't scroll behind a shown card", async ({
	page
}) => {
	await page.goto('/info-tokens');
	await newCard(page, 'A card with a great many words on it, to fill the example box right up');
	// Any scrollbar is the box's own, at its edge (Trevor, 2026-10-18).
	const preview = page.getByRole('figure', { name: 'Preview' });
	const [box, card] = await Promise.all([
		preview.boundingBox(),
		preview.locator('.content').boundingBox()
	]);
	expect(card?.width).toBeCloseTo(box?.width ?? 0, -1);
	await page.getByRole('button', { name: 'Confirm' }).tap();

	await page
		.getByRole('button', {
			name: 'A card with a great many words on it, to fill the example box right up',
			exact: true
		})
		.tap();
	await expect(page.locator('[data-testid="show-to-player"][open]')).toBeVisible();
	await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
	await page
		.locator('[data-testid="show-to-player"][open]')
		.getByRole('button', { name: 'Close' })
		.tap();
	await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
});

test('every section lists its cards A to Z', async ({ page }) => {
	await page.goto('/info-tokens');
	// Trevor (2026-10-18): built-in and custom alike, by their words.
	await expect(page.getByRole('button', { name: 'This is the Demon', exact: true })).toBeVisible();
	for (const heading of ['Standard', 'Enhanced']) {
		const names = await page
			.locator('section.collapsible')
			.filter({ has: page.getByRole('heading', { name: heading }) })
			.locator('button.card')
			.allTextContents();
		const words = names.map((name) => name.trim());
		expect(words.length).toBeGreaterThan(1);
		expect(words).toEqual(
			[...words].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
		);
	}
});
