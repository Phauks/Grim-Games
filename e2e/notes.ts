import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Titled notes (ui/notes/NoteList): each written in its own row, the title on the first line and
 * the text under it (Trevor, 2026-11-02: "edit them in-line"), kept as focus leaves the row.
 */
type Scope = Locator | Page;

/** The kept notes in a list; a new note not yet written in is `[data-new-note]`. */
export const noteRows = (scope: Scope) => scope.locator('[data-note]');
export const newNoteRow = (scope: Scope) => scope.locator('[data-new-note]');
export const noteTitle = (row: Locator) => row.getByRole('textbox', { name: 'Title' });
export const noteText = (row: Locator) => row.getByRole('textbox', { name: 'Text' });

/** Leaves the note being written, as tapping elsewhere does, which keeps it. */
export async function leaveNote(page: Page): Promise<void> {
	await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Taps "+ New note" in `scope`, writes in the new row, and leaves it. */
export async function addNote(
	page: Page,
	scope: Scope,
	note: { title?: string; text?: string }
): Promise<void> {
	await scope.getByTestId('new-note').tap();
	const row = newNoteRow(scope);
	if (note.title !== undefined) await noteTitle(row).fill(note.title);
	if (note.text !== undefined) await noteText(row).fill(note.text);
	await leaveNote(page);
}

/** Changes a kept note's text in its row, and leaves it. */
export async function rewriteNote(page: Page, row: Locator, text: string): Promise<void> {
	await noteText(row).fill(text);
	await leaveNote(page);
}

/** Each kept note as "Title: text" ("Untitled", "Hidden" as shown), or the title alone. */
export function noteSummaries(scope: Scope): () => Promise<string[]> {
	return () =>
		noteRows(scope).evaluateAll((rows) =>
			rows.map((row) => {
				const title = row.querySelector('input')?.value.trim() || 'Untitled';
				const body = row.querySelector<HTMLElement>('[role="textbox"]:not(input), p');
				const text = body?.innerText.trim() ?? '';
				return text ? `${title}: ${text}` : title;
			})
		);
}

/** The kept notes in `scope` are these, in order (see `noteSummaries`). */
export async function expectNotes(scope: Scope, expected: string[]): Promise<void> {
	await expect.poll(noteSummaries(scope)).toEqual(expected);
}
