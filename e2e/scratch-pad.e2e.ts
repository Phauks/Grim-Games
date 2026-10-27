import { expect, test, type Locator, type Page } from '@playwright/test';
import { touchDrag } from './touch.ts';

// The player's handwriting scratch pads (Notes tab): draw with a finger or pen, undo, redo,
// saved on the device (Trevor, 2026-10-16). Each pad opens full screen (Trevor, 2026-10-17),
// only when chosen; several pads are kept like notes, each with its own title, paper, lock
// and hide (Trevor, 2026-10-17).

/** How many pixels of the canvas carry ink. */
const inked = (canvas: Locator) =>
	canvas.evaluate((element) => {
		const c = element as HTMLCanvasElement;
		const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
		let count = 0;
		for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
		return count;
	});

/** Pixels between the ink and each edge of the canvas, plus the canvas's size. */
const inkMargins = (canvas: Locator) =>
	canvas.evaluate((element) => {
		const c = element as HTMLCanvasElement;
		const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
		let [left, right, top, bottom] = [c.width, -1, c.height, -1];
		for (let y = 0; y < c.height; y++)
			for (let x = 0; x < c.width; x++)
				if (data[(y * c.width + x) * 4 + 3] > 0) {
					left = Math.min(left, x);
					right = Math.max(right, x);
					top = Math.min(top, y);
					bottom = Math.max(bottom, y);
				}
		return {
			left,
			right: c.width - 1 - right,
			top,
			bottom: c.height - 1 - bottom,
			width: c.width,
			height: c.height
		};
	});

const padRows = (page: Page) => page.locator('[data-pad]');

async function ready(page: Page) {
	const dialog = page.getByRole('dialog', { name: 'Scratch pad' });
	await expect(dialog).toBeVisible();
	const canvas = dialog.getByTestId('scratch-canvas');
	await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(100);
	return { dialog, canvas };
}

async function notesTab(page: Page) {
	await page.getByRole('tab', { name: 'Notes', exact: true }).tap();
	await expect(page.getByRole('heading', { name: 'Scratch pads' })).toBeVisible();
}

/** A new pad, from the Notes tab: it opens full screen. */
async function newPad(page: Page) {
	await notesTab(page);
	await page.getByRole('button', { name: 'New pad' }).tap();
	return ready(page);
}

/** Opens the `index`th pad in the list. */
async function openPad(page: Page, index = 0) {
	await notesTab(page);
	await padRows(page).nth(index).tap();
	return ready(page);
}

async function scribble(page: Page, canvas: Locator, row = 0.3) {
	const box = (await canvas.boundingBox())!;
	await touchDrag(
		page,
		{ x: box.x + box.width * 0.2, y: box.y + box.height * row },
		{ x: box.x + box.width * 0.8, y: box.y + box.height * (row + 0.1) }
	);
}

test.beforeEach(async ({ page }) => {
	await page.goto('/play#e=tb');
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
});

test('pads open only when chosen; a finger draws, with undo, redo and a confirmed delete', async ({
	page
}) => {
	// Nothing opens by itself: the Notes tab lists pads, and there are none yet.
	await notesTab(page);
	await expect(page.getByTestId('scratch-canvas')).toHaveCount(0);
	await expect(padRows(page)).toHaveCount(0);

	const { dialog, canvas } = await newPad(page);
	const undo = dialog.getByRole('button', { name: 'Undo' });
	const redo = dialog.getByRole('button', { name: 'Redo' });
	await expect(undo).toBeDisabled();
	expect(await inked(canvas)).toBe(0);

	await scribble(page, canvas);
	await expect.poll(() => inked(canvas)).toBeGreaterThan(0);
	await expect(undo).toBeEnabled();

	await undo.tap();
	await expect.poll(() => inked(canvas)).toBe(0);
	await redo.tap();
	await expect.poll(() => inked(canvas)).toBeGreaterThan(0);

	// The eraser cuts through the ink.
	const before = await inked(canvas);
	await dialog.getByRole('button', { name: 'Eraser' }).tap();
	await scribble(page, canvas);
	await expect.poll(() => inked(canvas)).toBeLessThan(before);

	// Straight after a stroke, a tap still picks a colour (a stroke never becomes a fling).
	await dialog.getByRole('button', { name: 'Red', exact: true }).tap();
	await expect(dialog.getByRole('button', { name: 'Red', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await scribble(page, canvas, 0.6);

	// Saved on the device: still there after a reload, and nothing opens until it's tapped.
	await page.waitForTimeout(500);
	await page.reload();
	await notesTab(page);
	await expect(page.getByRole('dialog', { name: 'Scratch pad' })).toBeHidden();
	await expect(padRows(page)).toHaveCount(1);
	await expect.poll(() => inked(padRows(page).first().locator('canvas'))).toBeGreaterThan(0);
	const { dialog: again, canvas: reopened } = await openPad(page);
	await expect.poll(() => inked(reopened)).toBeGreaterThan(0);

	await again.getByRole('button', { name: 'Delete pad' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Delete this pad?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(again).toBeHidden();
	await expect(padRows(page)).toHaveCount(0);
	await page.waitForTimeout(500);
	await page.reload();
	await notesTab(page);
	await expect(padRows(page)).toHaveCount(0);
});

test('My notes and Scratch pads close from their headers and stay closed', async ({ page }) => {
	await notesTab(page);
	const pads = page.getByRole('button', { name: 'Scratch pads' });
	const notes = page.getByRole('button', { name: 'My notes' });
	await expect(pads).toHaveAttribute('aria-expanded', 'true');
	await pads.tap();
	await expect(pads).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByRole('button', { name: 'New pad' })).toBeHidden();
	await notes.tap();
	await expect(page.getByRole('button', { name: 'New note' })).toBeHidden();

	// Remembered on this device, as the Script tab's sections are.
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	await notesTab(page);
	await expect(pads).toHaveAttribute('aria-expanded', 'false');
	await expect(notes).toHaveAttribute('aria-expanded', 'false');
	await pads.tap();
	await expect(page.getByRole('button', { name: 'New pad' })).toBeVisible();
});

test('several pads, each with its own title and paper', async ({ page }) => {
	const viewport = page.viewportSize()!;
	const first = await newPad(page);
	// As much paper as the screen has.
	const box = (await first.canvas.boundingBox())!;
	expect(box.width).toBeGreaterThan(viewport.width * 0.85);
	expect(box.height).toBeGreaterThan(viewport.height * 0.6);

	const title = first.dialog.getByRole('textbox', { name: 'Title' });
	await expect(title).not.toBeFocused();
	await title.fill('Day 1');
	await title.press('Enter');
	const paperOf = (dialog: Locator) =>
		dialog
			.getByTestId('scratch-canvas')
			.evaluate((c) => getComputedStyle(c.parentElement!.parentElement!).backgroundColor);
	const leather = await paperOf(first.dialog);
	await first.dialog.getByRole('button', { name: 'Paper' }).tap();
	const papers = page.getByRole('dialog', { name: 'Paper' });
	await papers.getByRole('button', { name: 'Parchment' }).tap();
	await expect(papers.getByRole('button', { name: 'Parchment' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect.poll(() => paperOf(first.dialog)).not.toBe(leather);
	const parchment = await paperOf(first.dialog);
	await page.keyboard.press('Escape');
	await expect(papers).toBeHidden();
	await scribble(page, first.canvas);
	await expect.poll(() => inked(first.canvas)).toBeGreaterThan(0);
	await page.keyboard.press('Escape');
	await expect(first.dialog).toBeHidden();

	// A second pad starts blank, on the usual paper.
	const second = await newPad(page);
	expect(await inked(second.canvas)).toBe(0);
	expect(await paperOf(second.dialog)).toBe(leather);
	await page.keyboard.press('Escape');
	await expect(second.dialog).toBeHidden();
	await expect(padRows(page)).toHaveCount(2);
	await expect(padRows(page).first()).toContainText('Day 1');
	await expect(padRows(page).nth(1)).toContainText('Untitled');
	// Two to a row, even on a phone, each preview shaped like a phone's pad rather than a long
	// strip of paper no one could write on (Trevor, 2026-10-19: "2x2 on mobile").
	const [a, b] = [
		(await padRows(page).first().boundingBox())!,
		(await padRows(page).nth(1).boundingBox())!
	];
	expect(Math.abs(a.y - b.y)).toBeLessThan(1);
	expect(b.x).toBeGreaterThan(a.x + a.width - 1);
	const thumb = (await padRows(page).first().locator('canvas').boundingBox())!;
	expect(thumb.height).toBeGreaterThan(thumb.width);

	// Each keeps its own, across a reload too.
	await page.waitForTimeout(500);
	await page.reload();
	const again = await openPad(page, 0);
	await expect(again.dialog.getByRole('textbox', { name: 'Title' })).toHaveValue('Day 1');
	await expect.poll(() => paperOf(again.dialog)).toBe(parchment);
	await expect.poll(() => inked(again.canvas)).toBeGreaterThan(0);
});

test('a locked pad stays open without a stray touch drawing on it', async ({ page }) => {
	const { dialog, canvas } = await newPad(page);
	const lock = dialog.getByTestId('scratch-lock');
	await lock.tap();
	await expect(lock).toHaveAttribute('aria-pressed', 'true');
	await expect(dialog.getByRole('button', { name: 'Pen' })).toBeDisabled();
	await expect(dialog.getByRole('slider', { name: 'Pen size' })).toBeDisabled();
	await scribble(page, canvas);
	await page.waitForTimeout(200);
	expect(await inked(canvas)).toBe(0);
	await expect(dialog.getByTestId('scratch-ring')).toBeHidden();

	// Still locked after a reload; unlocked, it draws again.
	await page.waitForTimeout(500);
	await page.reload();
	const again = await openPad(page);
	await expect(again.dialog.getByTestId('scratch-lock')).toHaveAttribute('aria-pressed', 'true');
	await again.dialog.getByTestId('scratch-lock').tap();
	await scribble(page, again.canvas);
	await expect.poll(() => inked(again.canvas)).toBeGreaterThan(0);
});

test('a hidden pad shows only its title in the list', async ({ page }) => {
	const { dialog, canvas } = await newPad(page);
	await scribble(page, canvas);
	await expect.poll(() => inked(canvas)).toBeGreaterThan(0);
	const row = padRows(page).first();
	const before = (await row.boundingBox())!;
	await dialog.getByTestId('scratch-hide').tap();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(row).toContainText('Hidden');
	await expect(row.locator('canvas')).toHaveCount(0);
	// The row keeps its size, so nothing below it moves.
	expect((await row.boundingBox())!.height).toBeCloseTo(before.height, 0);

	await row.tap();
	const again = await ready(page);
	await expect.poll(() => inked(again.canvas)).toBeGreaterThan(0);
	await again.dialog.getByTestId('scratch-hide').tap();
	await page.keyboard.press('Escape');
	await expect(row.locator('canvas')).toHaveCount(1);
});

// The list preview fits what was drawn, centred, with no empty space beside it (Trevor,
// 2026-10-18).
test('a pad preview fits the drawing, centred in its box', async ({ page }) => {
	const { canvas } = await newPad(page);
	const box = (await canvas.boundingBox())!;
	// A tall box near the pad's left edge.
	const x1 = box.x + box.width * 0.1;
	const x2 = box.x + box.width * 0.25;
	const y1 = box.y + box.height * 0.1;
	const y2 = box.y + box.height * 0.9;
	await touchDrag(page, { x: x1, y: y1 }, { x: x1, y: y2 });
	await touchDrag(page, { x: x2, y: y1 }, { x: x2, y: y2 });
	await expect.poll(() => inked(canvas)).toBeGreaterThan(0);
	await page.keyboard.press('Escape');

	const thumb = padRows(page).first().locator('canvas');
	await expect.poll(() => inked(thumb)).toBeGreaterThan(0);
	const extent = await inkMargins(thumb);
	// Centred both ways, and most of the preview's height: the preview is shaped like a phone's
	// pad (Trevor, 2026-10-19), so the drawing is never stretched past the pad's own size.
	expect(Math.abs(extent.left - extent.right)).toBeLessThanOrEqual(extent.height * 0.1);
	expect(Math.abs(extent.top - extent.bottom)).toBeLessThanOrEqual(extent.height * 0.1);
	expect(extent.top + extent.bottom).toBeLessThanOrEqual(extent.height * 0.4);
});

// On a wide screen the pad is wide, so its preview is too: a pad traced round its edges shows
// as the whole preview, not a band in a tall box (Trevor, 2026-10-23). Opened again on a tall
// screen, the drawing shrinks until it all shows.
test('a wide pad has a wide preview, and still fits on a tall screen', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	const { canvas } = await newPad(page);
	const box = (await canvas.boundingBox())!;
	const at = (x: number, y: number) => ({
		x: box.x + box.width * x,
		y: box.y + box.height * y
	});
	await touchDrag(page, at(0.05, 0.05), at(0.95, 0.05));
	await touchDrag(page, at(0.95, 0.05), at(0.95, 0.95));
	await touchDrag(page, at(0.95, 0.95), at(0.05, 0.95));
	await touchDrag(page, at(0.05, 0.95), at(0.05, 0.05));
	await expect.poll(() => inked(canvas)).toBeGreaterThan(0);
	await page.keyboard.press('Escape');

	const thumb = padRows(page).first().locator('canvas');
	await expect.poll(() => inked(thumb)).toBeGreaterThan(0);
	const preview = (await thumb.boundingBox())!;
	expect(preview.width).toBeGreaterThan(preview.height);
	// The outline fills the preview both ways.
	const wide = await inkMargins(thumb);
	expect(wide.left + wide.right).toBeLessThanOrEqual(wide.width * 0.15);
	expect(wide.top + wide.bottom).toBeLessThanOrEqual(wide.height * 0.15);

	await page.setViewportSize({ width: 390, height: 800 });
	const again = await openPad(page);
	await expect.poll(() => inked(again.canvas)).toBeGreaterThan(0);
	// Every edge of the outline is on the pad, none cut off at the side.
	const tall = await inkMargins(again.canvas);
	expect(tall.left).toBeGreaterThan(0);
	expect(tall.right).toBeGreaterThan(0);
	expect(tall.top).toBeGreaterThan(0);
	expect(tall.bottom).toBeGreaterThan(0);
	expect(tall.left + tall.right).toBeLessThanOrEqual(tall.width * 0.2);
});

test('once a pen is used, a resting palm does not draw', async ({ page }) => {
	const { canvas } = await newPad(page);
	const send = (type: string, pointerType: string, pointerId: number, x: number, y: number) =>
		canvas.evaluate(
			(element, e) => {
				const rect = element.getBoundingClientRect();
				element.dispatchEvent(
					new PointerEvent(e.type, {
						bubbles: true,
						cancelable: true,
						pointerType: e.pointerType,
						pointerId: e.pointerId,
						isPrimary: true,
						pressure: 0.5,
						clientX: rect.left + rect.width * e.x,
						clientY: rect.top + rect.height * e.y
					})
				);
			},
			{ type, pointerType, pointerId, x, y }
		);
	// The palm lands first, then the pen writes: the palm's mark is dropped.
	await send('pointerdown', 'touch', 2, 0.8, 0.8);
	await send('pointermove', 'touch', 2, 0.85, 0.85);
	await send('pointerdown', 'pen', 3, 0.2, 0.2);
	await send('pointermove', 'pen', 3, 0.3, 0.2);
	await send('pointerup', 'pen', 3, 0.3, 0.2);
	await send('pointerup', 'touch', 2, 0.85, 0.85);
	const palmArea = () =>
		canvas.evaluate((element) => {
			const c = element as HTMLCanvasElement;
			const data = c
				.getContext('2d')!
				.getImageData(c.width * 0.7, c.height * 0.7, c.width * 0.3, c.height * 0.3).data;
			let count = 0;
			for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
			return count;
		});
	expect(await palmArea()).toBe(0);
	expect(await inked(canvas)).toBeGreaterThan(0);
	// A finger after the pen is ignored too.
	const before = await inked(canvas);
	await send('pointerdown', 'touch', 4, 0.5, 0.9);
	await send('pointermove', 'touch', 4, 0.6, 0.95);
	await send('pointerup', 'touch', 4, 0.6, 0.95);
	expect(await inked(canvas)).toBe(before);
});

test('pen and eraser keep their own sizes, shown as a ring where they touch the pad', async ({
	page
}) => {
	const { dialog, canvas } = await newPad(page);
	const penSize = dialog.getByRole('slider', { name: 'Pen size' });
	const ring = dialog.getByTestId('scratch-ring');
	await expect(ring).toBeHidden();

	// Moving the slider shows the size in the middle of the pad, then the ring goes.
	await penSize.fill('1');
	await expect(ring).toBeVisible();
	await expect(ring).toBeHidden();
	await scribble(page, canvas);
	await expect.poll(() => inked(canvas)).toBeGreaterThan(0);
	const thin = await inked(canvas);
	await dialog.getByRole('button', { name: 'Undo' }).tap();
	await expect.poll(() => inked(canvas)).toBe(0);

	await penSize.fill('20');
	const small = (await ring.boundingBox())!.width;
	await scribble(page, canvas);
	await expect.poll(() => inked(canvas)).toBeGreaterThan(thin * 4);

	// Each tool remembers its size, across a reload too.
	await dialog.getByRole('button', { name: 'Eraser' }).tap();
	const eraserSize = dialog.getByRole('slider', { name: 'Eraser size' });
	await expect(eraserSize).toHaveValue('7');
	await eraserSize.fill('20');
	await expect.poll(async () => (await ring.boundingBox())?.width ?? 0).toBeGreaterThan(small);
	await page.reload();
	const { dialog: again } = await openPad(page);
	await expect(again.getByRole('slider', { name: 'Pen size' })).toHaveValue('20');
	await again.getByRole('button', { name: 'Eraser' }).tap();
	await expect(again.getByRole('slider', { name: 'Eraser size' })).toHaveValue('20');
});

test('the size ring follows a finger while it draws and a hovering pen', async ({ page }) => {
	const { dialog, canvas } = await newPad(page);
	const ring = dialog.getByTestId('scratch-ring');
	const send = (type: string, pointerType: string, x: number, y: number) =>
		canvas.evaluate(
			(element, e) => {
				const rect = element.getBoundingClientRect();
				element.dispatchEvent(
					new PointerEvent(e.type, {
						bubbles: true,
						cancelable: true,
						pointerType: e.pointerType,
						pointerId: 7,
						isPrimary: true,
						pressure: 0.5,
						clientX: rect.left + rect.width * e.x,
						clientY: rect.top + rect.height * e.y
					})
				);
			},
			{ type, pointerType, x, y }
		);
	const centre = async () => {
		const [r, c] = [(await ring.boundingBox())!, (await canvas.boundingBox())!];
		return { x: (r.x + r.width / 2 - c.x) / c.width, y: (r.y + r.height / 2 - c.y) / c.height };
	};

	// A finger hovering is impossible; the ring shows only while it draws.
	await send('pointermove', 'touch', 0.5, 0.5);
	await expect(ring).toBeHidden();
	await send('pointerdown', 'touch', 0.3, 0.4);
	await send('pointermove', 'touch', 0.4, 0.4);
	await expect(ring).toBeVisible();
	expect((await centre()).x).toBeCloseTo(0.4, 1);
	await send('pointerup', 'touch', 0.4, 0.4);
	await expect(ring).toBeHidden();

	// A pen shows the ring before it touches down, and it goes when the pen leaves.
	await send('pointermove', 'pen', 0.7, 0.6);
	await expect(ring).toBeVisible();
	expect((await centre()).y).toBeCloseTo(0.6, 1);
	await send('pointerleave', 'pen', 1.1, 0.6);
	await expect(ring).toBeHidden();
});
