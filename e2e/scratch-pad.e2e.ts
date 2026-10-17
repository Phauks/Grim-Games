import { expect, test, type Locator, type Page } from '@playwright/test';
import { touchDrag } from './touch.ts';

// The player's handwriting scratch pad (Notes tab): draw with a finger or pen, undo, redo,
// clear with a confirm, saved on the device (Trevor, 2026-10-16). It is a big page on the
// tab and opens full screen (Trevor, 2026-10-17).

/** How many pixels of the canvas carry ink. */
const inked = (canvas: Locator) =>
	canvas.evaluate((element) => {
		const c = element as HTMLCanvasElement;
		const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
		let count = 0;
		for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
		return count;
	});

/** The pad on the Notes tab, drawn on in place. */
async function openPad(page: Page) {
	await page.getByRole('tab', { name: 'Notes', exact: true }).tap();
	const dialog = page.getByRole('region', { name: 'Scratch pad' });
	const canvas = dialog.getByTestId('scratch-canvas');
	await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(100);
	await canvas.scrollIntoViewIfNeeded();
	return { dialog, canvas };
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

test('a finger draws on the scratch pad, with undo, redo and a confirmed clear', async ({
	page
}) => {
	const { dialog, canvas } = await openPad(page);
	const undo = dialog.getByRole('button', { name: 'Undo' });
	const redo = dialog.getByRole('button', { name: 'Redo' });
	const clear = dialog.getByRole('button', { name: 'Clear the scratch pad' });
	await expect(undo).toBeDisabled();
	await expect(clear).toBeDisabled();
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

	// Saved on the device: still there after a reload.
	// Straight after a stroke, a tap still picks a colour (a stroke never becomes a fling).
	await dialog.getByRole('button', { name: 'Red', exact: true }).tap();
	await expect(dialog.getByRole('button', { name: 'Red', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await scribble(page, canvas, 0.6);
	await page.waitForTimeout(500);
	await page.reload();
	const { dialog: again, canvas: reopened } = await openPad(page);
	await expect.poll(() => inked(reopened)).toBeGreaterThan(0);

	await again.getByRole('button', { name: 'Clear the scratch pad' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Clear the scratch pad?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect.poll(() => inked(reopened)).toBe(0);
	await expect(again.getByRole('button', { name: 'Clear the scratch pad' })).toBeDisabled();
});

test('once a pen is used, a resting palm does not draw', async ({ page }) => {
	const { canvas } = await openPad(page);
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
	const { dialog, canvas } = await openPad(page);
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
	const { dialog, canvas } = await openPad(page);
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

test('the pad is a big page on the Notes tab and opens full screen with the same drawing', async ({
	page
}) => {
	const { dialog: section, canvas } = await openPad(page);
	const viewport = page.viewportSize()!;
	const box = (await canvas.boundingBox())!;
	expect(box.height).toBeGreaterThan(viewport.height * 0.6);
	expect(box.width).toBeGreaterThan(viewport.width * 0.8);
	await scribble(page, canvas);
	await expect.poll(() => inked(canvas)).toBeGreaterThan(0);

	await section.getByTestId('open-scratch-pad').tap();
	const full = page.getByRole('dialog', { name: 'Scratch pad' });
	await expect(full).toBeVisible();
	const big = full.getByTestId('scratch-canvas');
	await expect.poll(() => inked(big)).toBeGreaterThan(0);
	const fullBox = (await big.boundingBox())!;
	expect(fullBox.width).toBeGreaterThan(viewport.width * 0.85);
	expect(fullBox.height).toBeGreaterThan(viewport.height * 0.6);

	// Drawn full screen, it shows on the Notes tab too.
	await full.getByRole('button', { name: 'Undo' }).tap();
	await expect.poll(() => inked(big)).toBe(0);
	await page.keyboard.press('Escape');
	await expect(full).toBeHidden();
	await expect.poll(() => inked(canvas)).toBe(0);
});
