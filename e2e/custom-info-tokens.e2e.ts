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
	await page.getByRole('button', { name: 'Red' }).tap();
	await expect(page.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
	await expect(preview.locator('[data-ink="red"]')).toHaveText('You');

	await page.getByRole('button', { name: 'Save' }).tap();
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

test('a card that belongs to a character sits under Character Specific', async ({ page }) => {
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
	await dialog.getByRole('button', { name: 'Save' }).tap();

	const tile = page.getByRole('button', { name: /^You feel uneasy/ });
	await expect(tile).toContainText('Empath');
	// Listed with the character cards, not with the other custom cards.
	await expect(
		page
			.locator('.collapsible', { hasText: 'Character Specific' })
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

test('a fill-in card asks for its word each time and shows it', async ({ page }) => {
	await page.goto('/info-tokens');
	await newCard(page, 'Your number is');
	await page.getByText('Fill in when shown').tap();
	await expect(page.getByRole('figure', { name: 'Preview' })).toContainText('…');
	await page.getByRole('button', { name: 'Save' }).tap();

	await page.getByRole('button', { name: 'Your number is', exact: true }).tap();
	await page.getByRole('textbox', { name: 'Fill in' }).fill('42');
	await page.getByRole('button', { name: 'Show' }).tap();
	const shown = page.getByTestId('show-to-player');
	await expect(shown.getByRole('heading')).toHaveText('Your number is');
	await expect(shown).toContainText('42');
});
