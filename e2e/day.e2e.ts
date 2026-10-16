import { expect, test, type Locator, type Page } from '@playwright/test';

// Spike: the day log and the night answers it feeds (/spikes/day), touch only.

async function loaded(page: Page) {
	await page.goto('/spikes/day');
	await expect(page.getByRole('button', { name: 'Seat: Ana' })).toBeVisible();
}

async function sampleGame(page: Page, name: 'Sects & Violets' | 'Trouble Brewing' | 'Assorted') {
	await page
		.getByRole('radiogroup', { name: 'Sample game' })
		.getByText(name, { exact: true })
		.tap();
}

/** Walks the night one step at a time until the step for `title` is showing. */
async function walkTo(page: Page, title: string): Promise<Locator> {
	const step = page.getByRole('article', { name: `Night step: ${title}` });
	for (let i = 0; i < 30 && !(await step.isVisible()); i++) {
		await page.getByRole('button', { name: 'Next' }).tap();
	}
	await expect(step).toBeVisible();
	return step;
}

/** Where an element sits on the page (not the viewport, which scrolls on tap). */
const place = (locator: Locator) =>
	locator.evaluate((el) => {
		const r = el.getBoundingClientRect();
		return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
	});

test('Demon voted feeds the Flowergirl, and there is no New day button', async ({ page }) => {
	await loaded(page);
	// Nominations happen off the grimoire, so there is nothing to tap for them.
	await expect(page.getByRole('radiogroup', { name: 'Tapping a player' })).toHaveCount(0);

	await page.getByText('Demon voted', { exact: true }).tap();
	await expect(
		page.getByRole('checkbox', { name: 'Demon voted', includeHidden: true })
	).toBeChecked();
	await page.getByRole('button', { name: 'Night order' }).tap();
	const flowergirl = await walkTo(page, 'Flowergirl');
	await expect(flowergirl.getByRole('group', { name: 'Flowergirl answer' })).toContainText(
		'Yes: the Demon Fay (Fang Gu) voted'
	);

	// A new day starts when the night ends, not from a button here (Trevor, 2026-10-16).
	await page.getByRole('button', { name: 'Back to day' }).tap();
	await expect(page.getByRole('button', { name: 'New day' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('the Slayer is marked Used after a confirm and unmarked by a tap, and the Washerwoman picks her info', async ({
	page
}) => {
	await loaded(page);
	await sampleGame(page, 'Trouble Brewing');
	const used = page.getByRole('button', { name: 'Used: Slayer (Ben)' });
	const before = await place(used);
	await used.tap();
	const confirm = page.getByRole('alertdialog', { name: 'Mark Slayer (Ben) as used?' });
	await expect(confirm).toContainText('Slayer (Ben) has not used their ability.');
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(used).toHaveAttribute('aria-pressed', 'true');
	// The reminder stays where it was, pressed, so the list does not jump.
	expect(await place(used)).toEqual(before);
	// Tapping it again unmarks it, with no confirm (Trevor: a mistaken Used must be undoable).
	await used.tap();
	await expect(used).toHaveAttribute('aria-pressed', 'false');
	await expect(confirm).toBeHidden();
	await used.tap();
	await confirm.getByRole('button', { name: 'Mark used' }).tap();
	await expect(used).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('button', { name: 'Night order' }).tap();
	await page
		.getByRole('radiogroup', { name: 'Which night' })
		.getByText('First', { exact: true })
		.tap();
	const step = await walkTo(page, 'Washerwoman');
	await step.getByRole('button', { name: 'Pick info for Ana' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Washerwoman · Ana' });
	await expect(sheet).toBeVisible();
	const players = sheet.getByRole('group', { name: 'Players' });
	// Truthful players come first: Ben (Slayer) leads.
	await expect(players.getByRole('button').first()).toHaveText('Ben');
	await expect(players.getByRole('button', { name: 'Ben' })).toHaveAttribute(
		'data-truthful',
		'true'
	);
	await players.getByRole('button', { name: 'Ben' }).tap();
	await players.getByRole('button', { name: 'Gus' }).tap();
	await sheet
		.getByRole('group', { name: 'Characters' })
		.getByRole('button', { name: 'Slayer' })
		.tap();
	await expect(sheet.getByTestId('info-verdict')).toHaveText('True.');
	await sheet.getByRole('button', { name: 'Record' }).tap();
	await expect(sheet).toBeHidden();
	await expect(step.getByTestId('info-shown')).toHaveText(
		'Recorded: Shown Ben and Gus: one is the Slayer'
	);
});

test('any reminder takes an optional long note in a sheet', async ({ page }) => {
	await loaded(page);
	await page.getByRole('button', { name: 'Note: Gossip (Dev)' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Note: Gossip · Dev' });
	const text = `Said: “Eve is the Witch.”\n\n${'They were very sure of it. '.repeat(40)}`;
	await sheet.getByTestId('note-text').fill(text);
	await sheet.getByRole('button', { name: 'Save note' }).tap();
	await expect(sheet).toBeHidden();
	const note = page.getByRole('button', { name: 'Note: Gossip (Dev)' });
	await expect(note).toHaveAttribute('data-has-note', 'true');
	// Reopening shows the whole note (there is no log on the day page).
	await note.tap();
	await expect(sheet.getByTestId('note-text')).toHaveValue(text);
});

test('with help switched off the night is a checklist with no worked-out answers', async ({
	page
}) => {
	await loaded(page);
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Storyteller settings' })
		.tap();
	for (const name of ['Walk me through the night', 'Work out night answers', 'Pre-day reminders']) {
		await settings.getByText(name, { exact: true }).tap();
	}
	await settings.getByRole('button', { name: 'Close' }).tap();
	await expect(settings).toBeHidden();

	// Pre-day reminders are off, but Used, notes and the players stay.
	await expect(page.getByRole('heading', { name: 'Abilities and notes' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Seat: Eve' })).toBeVisible();

	await page.getByRole('button', { name: 'Night order' }).tap();
	const checklist = page.getByTestId('night-checklist');
	await expect(checklist).toBeVisible();
	await expect(page.getByTestId('night-walkthrough')).toHaveCount(0);
	await expect(checklist.locator('[data-step="towncrier"]')).toBeVisible();
	await expect(page.getByRole('group', { name: 'Town Crier answer' })).toHaveCount(0);
});

test('impaired abilities, registration ranges, the Mathematician and a Gambler death', async ({
	page
}) => {
	await loaded(page);
	await sampleGame(page, 'Assorted');
	// The Preacher (Gus) chose the Poisoner (Dev): one line, naming the Preacher.
	const poisoner = page.locator('li[data-character="poisoner"]');
	await expect(poisoner).toHaveCount(1);
	await expect(poisoner).toContainText('has no ability');
	await expect(poisoner).toContainText('Preacher · Gus');

	await page.getByRole('button', { name: 'Night order' }).tap();
	await page
		.getByRole('radiogroup', { name: 'Which night' })
		.getByText('First', { exact: true })
		.tap();
	const dev = await walkTo(page, 'Poisoner');
	await expect(dev.getByTestId('step-impaired')).toHaveText('Dev · No Ability · Gus (Preacher)');

	// Cat the Recluse sits next to the Poisoner and the Imp: 1 pair, or 2 if evil.
	const chef = await walkTo(page, 'Chef');
	await expect(chef.getByTestId('info-range')).toHaveText('1 (1 / 2)');
	await chef.getByRole('button', { name: 'Pick info for Ben' }).tap();
	const sheet = page.getByRole('dialog', { name: 'Chef · Ben' });
	await sheet.getByRole('group', { name: 'Number' }).getByRole('button', { name: '2' }).tap();
	await expect(sheet.getByTestId('info-verdict')).toContainText('Might register falsely: Cat');
	await sheet.getByRole('button', { name: 'Record' }).tap();
	await expect(sheet).toBeHidden();

	const mathematician = await walkTo(page, 'Mathematician');
	await expect(mathematician.getByRole('group', { name: 'Mathematician answer' })).toContainText(
		'Show 1: Ben (Chef)'
	);

	await page
		.getByRole('radiogroup', { name: 'Which night' })
		.getByText('Others', { exact: true })
		.tap();
	const gambler = await walkTo(page, 'Gambler');
	await gambler.getByRole('button', { name: 'Pick for Ana' }).tap();
	const choice = page.getByRole('dialog', { name: 'Gambler · Ana' });
	await choice.getByRole('group', { name: 'Players' }).getByRole('button', { name: 'Ben' }).tap();
	await choice
		.getByRole('group', { name: 'Characters' })
		.getByRole('button', { name: 'Imp' })
		.tap();
	await expect(choice.getByTestId('death-verdict')).toHaveText('Dead: Ana');
	await choice.getByRole('button', { name: 'Dead: Ana' }).tap();
	await expect(choice).toBeHidden();

	await page.getByRole('button', { name: 'Back to day' }).tap();
	await expect(page.getByRole('button', { name: 'Seat: Ana' })).toHaveAttribute(
		'data-dead',
		'true'
	);
});
