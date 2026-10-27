import { expect, type Page } from '@playwright/test';

/**
 * Counts the page's IndexedDB writes still running. A game saves each command to IndexedDB
 * after the tap returns, and a `page.goto` straight after it can unload the page before the
 * write lands: the board then opens without the last change (CI flakes on 2026-10-26 and 27,
 * where Seat 7's Imp tile was missing). Call before the page's first `goto`.
 */
export async function trackSaves(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const counter = window as unknown as { pendingWrites: number };
		counter.pendingWrites = 0;
		const open = IDBDatabase.prototype.transaction;
		IDBDatabase.prototype.transaction = function (
			this: IDBDatabase,
			...args: Parameters<IDBDatabase['transaction']>
		) {
			const tx = open.apply(this, args);
			if (args[1] === 'readwrite') {
				counter.pendingWrites++;
				let done = false;
				const end = () => {
					if (done) return;
					done = true;
					counter.pendingWrites--;
				};
				tx.addEventListener('complete', end);
				tx.addEventListener('abort', end);
			}
			return tx;
		};
	});
}

/** Waits until every IndexedDB write the page started has landed (see `trackSaves`). */
export async function savesSettled(page: Page): Promise<void> {
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { pendingWrites: number }).pendingWrites))
		.toBe(0);
}
