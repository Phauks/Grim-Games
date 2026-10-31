/**
 * The token in hand (Trevor, 2026-10-30: "selecting a token from the board or from the bank is
 * the same"): a token tapped in the reminder bank, or one already on the board, waiting for
 * where the board is tapped next. Shared by the bank (ReminderBank), the board's tokens
 * (GrimoireBoard) and the pill that shows it (ReminderHandPill).
 */
import type { ReminderId, SeatId } from '#lib/core/model/index.ts';
import type { BankItem } from './bank-items.ts';

/** A bank token by what it is, or a placed one by id with the seat it is on, if any. */
export type HeldToken =
	{ kind: 'bank'; item: BankItem } | { kind: 'placed'; reminderId: ReminderId; from?: SeatId };

/** Whether two held tokens are the same token. */
export function sameToken(a: HeldToken | undefined, b: HeldToken): boolean {
	if (!a || a.kind !== b.kind) return false;
	return a.kind === 'bank'
		? a.item.key === (b as { item: BankItem }).item.key
		: a.reminderId === (b as { reminderId: ReminderId }).reminderId;
}

export class ReminderHand {
	held = $state<HeldToken>();
	/** The held token's ⋯ open (a right-click opens it too). */
	menuOpen = $state(false);
	/** The token whose own dialog is open, held or not. */
	about = $state<HeldToken>();
	aboutOpen = $state(false);

	/** Holds the token, or puts it down if it is the one in hand (tapping an open item closes it). */
	toggle(token: HeldToken): void {
		this.held = sameToken(this.held, token) ? undefined : token;
	}

	putDown(): void {
		this.held = undefined;
	}

	showAbout(token: HeldToken): void {
		this.about = token;
		this.aboutOpen = true;
	}
}
