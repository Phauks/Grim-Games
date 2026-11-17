import type { CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { BankItem } from '#lib/features/board/bank-items.ts';
import type { TrayGestures } from '#lib/features/board/tray-gestures.svelte.ts';
import { sidePane } from '#lib/features/room/side-pane.svelte.ts';

/** A token a pane row lists: whose and which. */
export type PaneToken = { characterId: CharacterId; label: ReminderLabel };
/** Where that copy is on the board, if it is. */
export type PaneTokenAt = { reminderId: string; seatId: SeatId };
/** A pane row's token dragged to a client point; `end` when let go, `cancel` if given up. */
export type PaneTokenDrag = (
	token: PaneToken,
	at: PaneTokenAt | undefined,
	x: number,
	y: number,
	end: boolean | 'cancel'
) => void;

/**
 * Dragging a token from the Storyteller's pane onto the board (Trevor, 2026-11-16: "just move
 * the one they drag"): a copy on a seat moves as one dragged on the board does, and one not
 * placed comes from the reminder bank as one dragged from it does. The bank's own gestures, so
 * the drop works the same everywhere.
 */
export function paneTokenDrag(
	gestures: TrayGestures,
	bankItem: (token: PaneToken) => BankItem | undefined
): PaneTokenDrag {
	return (token, at, x, y, end) => {
		if (end === 'cancel') return gestures.cancel();
		if (at) return gestures.dragPlaced(at.reminderId, at.seatId, x, y, end);
		const item = bankItem(token);
		if (item) gestures.dragTray(item, x, y, end);
	};
}

/** What a pane row's tokens do on the board (`paneTokens`). */
export interface PaneTokens {
	/** Place or Move: the token in hand, to tap a seat with. */
	place(token: PaneToken, at?: PaneTokenAt): void;
	/** A drag onto the board; none on a phone, whose sheet covers it. */
	readonly drag: PaneTokenDrag | undefined;
}

/** The reminder bank, as the pane's tokens use it (ReminderBank). */
interface PaneBank {
	hold(token: PaneToken): boolean;
	itemFor(token: PaneToken): BankItem | undefined;
}

/**
 * What the pane's token rows do on the board, for a day row (a night step's Place goes
 * through its walk-through, which reopens the step): Place or Move puts the token in hand to
 * tap a seat with, the phone's sheet closing so the board shows; a drag beside the board
 * drops it where it is let go.
 */
export function paneTokens(gestures: TrayGestures, bank: () => PaneBank | undefined): PaneTokens {
	const drag = paneTokenDrag(gestures, (token) => bank()?.itemFor(token));
	return {
		place(token, at) {
			if (at) gestures.hand.held = { kind: 'placed', reminderId: at.reminderId, from: at.seatId };
			else if (!bank()?.hold(token)) return;
			if (!sidePane.beside) sidePane.hide();
		},
		get drag() {
			return sidePane.beside ? drag : undefined;
		}
	};
}
