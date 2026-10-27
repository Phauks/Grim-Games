import { expect, test, type Locator, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { openSettingsDialog } from './shell.ts';

// Trevor, 2026-10-27: "Same grim generates differently on devices, we should provide options to
// match". Every shared grim keeps each seat at the Storyteller's place round the ring; a switch
// draws the town in the board's own shape, on by default on Public Town.

type Box = { x: number; y: number; width: number; height: number };

/** Each seat's clock position in degrees round `box`, measured in % of the box. */
async function clock(seats: Locator, box: Box): Promise<number[]> {
	const out: number[] = [];
	for (const seat of await seats.all()) {
		const b = (await seat.boundingBox())!;
		const x = (b.x + b.width / 2 - box.x) / box.width - 0.5;
		const y = (b.y + b.height / 2 - box.y) / box.height - 0.5;
		out.push(((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360);
	}
	return out;
}

function expectSameClock(actual: number[], expected: number[]) {
	expect(actual).toHaveLength(expected.length);
	actual.forEach((deg, i) => {
		const off = Math.abs(((deg - expected[i] + 540) % 360) - 180);
		expect(off, `seat ${i + 1} at ${deg}°, the board's at ${expected[i]}°`).toBeLessThan(8);
	});
}

/** The largest box of the board's shape on `outer`, centred: the town drawn in its shape. */
function fitted(outer: Box, aspect: number): Box {
	const width = Math.min(outer.width, outer.height * aspect);
	const height = width / aspect;
	return {
		x: outer.x + (outer.width - width) / 2,
		y: outer.y + (outer.height - height) / 2,
		width,
		height
	};
}

async function startGame(page: Page) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	return new URL(page.url()).pathname;
}

test("Public Town keeps the Storyteller's seat places and board shape", async ({
	page,
	browser
}, testInfo) => {
	// The Storyteller's board is wide, the town's screen is not.
	await page.setViewportSize({ width: 1280, height: 720 });
	const board = await startGame(page);
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	const boardBox = (await page.locator('.board').boundingBox())!;
	const theirs = await clock(page.getByTestId('seat'), boardBox);
	const aspect = boardBox.width / boardBox.height;

	const tabletContext = await browser.newContext({ ...testInfo.project.use });
	const tablet = await tabletContext.newPage();
	await tablet.goto(`/town/${code}`);
	const town = tablet.getByTestId('player-grim');
	const seats = town.getByTestId('grim-seat');
	await expect(seats).toHaveCount(8);
	const townBox = (await town.boundingBox())!;
	expect(townBox.width / townBox.height).toBeLessThan(aspect);

	// On by default here: the town is the board's shape, centred, with space above and below.
	const button = tablet.getByTestId('match-shape');
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await expect(button).toBeEnabled();
	const shaped = fitted(townBox, aspect);
	await expect.poll(async () => (await seats.first().boundingBox())!.y).toBeGreaterThan(shaped.y);
	expectSameClock(await clock(seats, shaped), theirs);
	for (const seat of await seats.all()) {
		const b = (await seat.boundingBox())!;
		expect(b.y + b.height / 2).toBeGreaterThan(shaped.y);
		expect(b.y + b.height / 2).toBeLessThan(shaped.y + shaped.height);
	}

	// Off, the town fills the screen and the seats still sit at the board's places.
	await button.tap();
	await expect(button).toHaveAttribute('aria-pressed', 'false');
	await expect.poll(async () => (await seats.first().boundingBox())!.y).toBeLessThan(shaped.y - 4);
	expectSameClock(await clock(seats, townBox), theirs);

	// The same switch is in Settings > Player.
	const settings = await openSettingsDialog(tablet);
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Player' })
		.tap();
	await expect(
		settings.getByRole('checkbox', {
			name: "Public Town in the Storyteller's board shape",
			includeHidden: true
		})
	).not.toBeChecked();
	await tabletContext.close();
});
