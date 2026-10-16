import { expect, test, type Locator, type Page } from '@playwright/test';
import { touchDrag } from './touch.ts';

// The player's handwriting scratch pad (Notes tab): draw with a finger or pen, undo, redo,
// clear with a confirm, saved on the device (Trevor, 2026-10-16).

/** How many pixels of the canvas carry ink. */
const inked = (canvas: Locator) =>
	canvas.evaluate((element) => {
		const c = element as HTMLCanvasElement;
		const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
		let count = 0;
		for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
		return count;
	});

async function openPad(page: Page) {
	await page.getByRole('tab', { name: 'Notes', exact: true }).tap();
	await page.getByTestId('open-scratch-pad').tap();
	const dialog = page.getByRole('dialog', { name: 'Scratch pad' });
	await expect(dialog).toBeVisible();
	const canvas = dialog.getByTestId('scratch-canvas');
	await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(100);
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

	// Saved on the device: still there after a reload, shown small on the Notes tab.
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
