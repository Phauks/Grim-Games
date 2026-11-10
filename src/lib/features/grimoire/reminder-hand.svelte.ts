/**
 * The token in hand (Trevor, 2026-10-30: "selecting a token from the board or from the bank is
 * the same"): a token tapped in the reminder bank, or one already on the board, waiting for
 * where the board is tapped next. Shared by the bank (ReminderBank), the board's tokens
 * (GrimoireBoard) and the pill that shows it (ReminderHandPill).
 */
import type { GenericLook, ReminderId, SeatId } from '#lib/core/model/index.ts';
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
	/**
	 * The number the bank's # token places while it is held (plan M48, Trevor 2026-11-04: "it
	 * is easy to add a 1, but any other number requires going in and changing settings"): picked
	 * in the pill, 1 each time it is picked up.
	 */
	number = $state(1);
	/** The look a tray's plain ∞ or # token is given in hand, before it goes on a seat. */
	look = $state<GenericLook>({});

	/** Holds the token, or puts it down if it is the one in hand (tapping an open item closes it). */
	toggle(token: HeldToken): void {
		this.held = sameToken(this.held, token) ? undefined : token;
		this.look = {};
		if (this.held?.kind === 'bank' && this.held.item.number) this.number = 1;
	}

	/** Holds the token, fresh: no number or look given yet. */
	hold(token: HeldToken): void {
		this.held = token;
		this.look = {};
		this.number = 1;
	}

	putDown(): void {
		this.held = undefined;
		this.look = {};
	}

	showAbout(token: HeldToken): void {
		this.about = token;
		this.aboutOpen = true;
	}
}
