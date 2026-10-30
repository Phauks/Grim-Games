/**
 * The reminder bank's token in hand (Trevor, 2026-10-30): tapped, it waits for the board to
 * be tapped where it goes (ReminderBank), with its ⋯ in its pill (ReminderInHand).
 */
import type { BankItem } from './bank-items.ts';
import { duplicateReminder } from './duplicate-reminder.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import { isGeneric } from './reminders.ts';

interface Row {
	value: string;
	label: string;
	onSelect: () => void;
}

/**
 * The held token's ⋯ rows: About first, then only what this kind of token can do. Each but
 * About puts the token down, since it changes what the bank holds.
 */
export function heldTokenActions(
	grimoire: Grimoire,
	item: BankItem,
	on: { about: (item: BankItem) => void; edit: (tokenId: string) => void; putDown: () => void }
): Row[] {
	const done = (action: () => void) => () => {
		on.putDown();
		action();
	};
	const rows: Row[] = [
		{ value: 'about', label: 'About this reminder', onSelect: () => on.about(item) }
	];
	if (!isGeneric(item)) {
		rows.push({
			value: 'duplicate',
			label: 'Duplicate reminder',
			onSelect: done(() => duplicateReminder(grimoire, item))
		});
		// A Duplicate copy goes back out of the bank, as one on the board does (2026-10-24).
		if (item.extra && grimoire.bankCopyCount(item) > 0)
			rows.push({
				value: 'remove',
				label: 'Remove copy',
				onSelect: done(() => grimoire.removeBankCopy(item))
			});
	}
	const tokenId = item.token?.tokenId;
	if (tokenId)
		rows.push({ value: 'edit', label: 'Edit token', onSelect: done(() => on.edit(tokenId)) });
	const setupKey = item.setup?.key;
	if (setupKey)
		rows.push({
			value: 'dismiss',
			label: "Don't suggest",
			onSelect: done(() => grimoire.dismissTray(setupKey))
		});
	return rows;
}

/** How far a press may move and still be a tap, in px. */
const SLOP = 10;

/**
 * Takes the board's taps while a token is held: a tap anywhere on `board` but inside `keep`
 * (the bank and the pill) calls `onTap` at that client point instead of reaching what is
 * under it. A swipe does nothing. Returns the cleanup.
 */
export function dropOnTap(
	board: HTMLElement,
	keep: HTMLElement | undefined,
	onTap: (x: number, y: number) => void
): () => void {
	let down: { x: number; y: number; id: number } | undefined;
	const ours = (event: Event) => !!keep?.contains(event.target as Node);
	const pointerdown = (event: PointerEvent) => {
		if (ours(event) || !event.isPrimary) return;
		event.stopPropagation();
		down = { x: event.clientX, y: event.clientY, id: event.pointerId };
	};
	const pointerup = (event: PointerEvent) => {
		if (!down || event.pointerId !== down.id) return;
		event.stopPropagation();
		const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
		down = undefined;
		if (moved < SLOP) onTap(event.clientX, event.clientY);
	};
	// The click after it would open what is under the finger.
	const click = (event: MouseEvent) => {
		if (!ours(event)) event.stopPropagation();
	};
	board.addEventListener('pointerdown', pointerdown, true);
	board.addEventListener('pointerup', pointerup, true);
	board.addEventListener('click', click, true);
	return () => {
		board.removeEventListener('pointerdown', pointerdown, true);
		board.removeEventListener('pointerup', pointerup, true);
		// The last tap's click is still to come.
		setTimeout(() => board.removeEventListener('click', click, true));
	};
}
