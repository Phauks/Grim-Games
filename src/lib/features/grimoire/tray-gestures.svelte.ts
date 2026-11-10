/**
 * What a reminder tray does with a finger, ONE implementation for the Storyteller's bank
 * (ReminderBank, with the board's tokens) and a player's tray (PlayerReminderBin, with the
 * tokens on their Grim tab) (Trevor, 2026-11-10: "Why is this implemented twice. I just want
 * them to be the same"). Each view only says where things are and how its tokens are kept
 * (`TrayPlaces`): the board runs Game commands, a player's phone keeps its own.
 *
 * - A tray token tapped is held (`hand`), dragged it goes where it is let go.
 * - A token on a seat tapped is held, dragged it goes where it is let go.
 * - Let go (or a held token dropped by a tap) on "+ New token": a new ∞ token like it, which
 *   stays where it was; on the tray: a placed token comes off its seat; on a seat (or a
 *   Fabled or Loric on the board): placed or moved there.
 * - "+ New token" glows while any token is dragged, brighter with one over it.
 * - "+ New token" tapped: a copy of the token in hand, or a new token and its editor; Confirm
 *   puts the new token in hand, Cancel throws it away. Delete asks about its copies on seats.
 * - Taken from the pulled-up tray, a token lowers it to its row.
 */
import type { CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import type { GenericLook, GenericToken } from '#lib/core/model/index.ts';
import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
import { bankLabel, bankLook, genericStretch, type BankItem } from './bank-items.ts';
import { newTokenGlow, overNewToken, overTray } from './reminder-drag.svelte.ts';
import { ReminderHand } from './reminder-hand.svelte.ts';
import { copiedLook } from './reminders.ts';

/** Where a token goes: a seat, or (on the board) a Fabled or Loric. */
export type TraySpot = { seatId: string } | { ruleId: CharacterId };

/** What a token is, for copies and for the Fabled or Loric it may go on. */
export interface TrayTokenFace extends GenericLook {
	characterId: CharacterId;
	label: ReminderLabel;
}

/** How a view keeps its tokens, and where its seats are. */
export interface TrayPlaces {
	/** The area tokens lie on (the board, a player's town): a dragged token is in % of it. */
	area(): HTMLElement | undefined;
	/** The seat under a point in % of the area; `tap` must land on the character token. */
	seatAt(at: SeatPoint, tap: boolean): string | undefined;
	/** The Fabled or Loric under a client point (the board's only). */
	ruleAt?(x: number, y: number, face: TrayTokenFace): CharacterId | undefined;
	/** A placed token's face, by its id; undefined once it is gone. */
	placed(reminderId: string): TrayTokenFace | undefined;
	/** A tray token onto a seat or a Fabled or Loric, with the number and look it was given. */
	place(item: BankItem, to: TraySpot, number: number | undefined, look: GenericLook): void;
	/** A placed token onto a seat or a Fabled or Loric (the view may ask first). */
	move(reminderId: string, from: string | undefined, to: TraySpot): void;
	/** A placed token back to the tray (the view may ask first). */
	takeOff(reminderId: string): void;
	/** A new ∞ token in the tray with `look`; its id. */
	addToken(look?: GenericLook): string | undefined;
	/** One of the tray's ∞ tokens thrown away. */
	removeToken(tokenId: string): void;
	/** Its copies on seats, by id. */
	copiesOf(tokenId: string): string[];
	/** The tray's own ∞ tokens. */
	tokens(): readonly GenericToken[];
	/** Seats to mark while a token is on the move (the board's only). */
	hint?(face: TrayTokenFace | undefined, item: BankItem | undefined, target?: string): void;
}

/** A tray token's face as it would go down, with the number and look given in hand. */
export function trayFace(item: BankItem, number?: number, look: GenericLook = {}): TrayTokenFace {
	const { tokenId: _id, ...own } = item.token ?? { tokenId: '' };
	void _id;
	return {
		characterId: item.characterId,
		label: bankLabel(item),
		...(item.token ? own : bankLook(item, number)),
		...look
	};
}

export interface TrayDrag {
	at: SeatPoint;
	overNew: boolean;
	target?: string;
}

export class TrayGestures {
	/** The token in hand, from the tray or a seat. */
	readonly hand: ReminderHand;
	/** The tray pulled up by its handle bar to show every token. */
	open = $state(false);
	/** A tray token being dragged. */
	trayDrag = $state<TrayDrag & { item: BankItem }>();
	/** A placed token being dragged. */
	placedDrag = $state<TrayDrag & { reminderId: string; from: string | undefined }>();
	/** How "+ New token" looks: glowing while a token is dragged, brighter with one over it. */
	glow = $derived(
		newTokenGlow(
			!!this.trayDrag || !!this.placedDrag,
			!!this.trayDrag?.overNew || !!this.placedDrag?.overNew
		)
	);

	// ── The tray's own ∞ tokens: the editor and Delete's question ──
	editing = $state<string>();
	editorOpen = $state(false);
	/** The token in the editor was just made: Cancel deletes it, Confirm puts it in hand. */
	fresh = $state(false);
	deleting = $state<string>();
	deleteOpen = $state(false);

	#places: () => TrayPlaces;

	constructor(places: () => TrayPlaces, hand = new ReminderHand()) {
		this.#places = places;
		this.hand = hand;
	}

	/** A client point in % of the area. */
	#at(x: number, y: number): SeatPoint | undefined {
		const rect = this.#places().area()?.getBoundingClientRect();
		if (!rect) return undefined;
		return { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
	}

	face(item: BankItem, number?: number, look: GenericLook = {}): TrayTokenFace {
		return trayFace(item, number, look);
	}

	/** A new ∞ token in the tray like `face`; the token itself stays where it was. */
	copy(face: TrayTokenFace): void {
		this.hand.putDown();
		this.#places().addToken(copiedLook(face));
	}

	/**
	 * A tray token dragged to a client point; `end` when let go. `given`: a held token dropped
	 * by a tap, with the number and look it was given in hand (a tap must hit a character token).
	 */
	dragTray(
		item: BankItem,
		x: number,
		y: number,
		end: boolean,
		given?: { number: number; look: GenericLook }
	): void {
		const places = this.#places();
		const at = this.#at(x, y);
		if (!at) return;
		const overNew = overNewToken(x, y);
		const target = overNew ? undefined : places.seatAt(at, !!given);
		const number = given?.number;
		const look = given?.look ?? {};
		if (!end) {
			this.hand.putDown();
			this.trayDrag = { item, at, overNew, target };
			places.hint?.(overNew ? undefined : this.face(item), item, target);
			return;
		}
		this.trayDrag = undefined;
		places.hint?.(undefined, undefined);
		if (overNew) return this.copy(this.face(item, number, look));
		const rule = places.ruleAt?.(x, y, this.face(item));
		if (rule) return places.place(item, { ruleId: rule }, number, look);
		if (target) places.place(item, { seatId: target }, number, look);
	}

	/** A placed token dragged to a client point; `end` when let go, `tap` for a held one. */
	dragPlaced(
		reminderId: string,
		from: string | undefined,
		x: number,
		y: number,
		end: boolean,
		tap = false
	): void {
		const places = this.#places();
		const at = this.#at(x, y);
		if (!at) return;
		const overNew = overNewToken(x, y);
		const target = overNew ? undefined : places.seatAt(at, tap);
		if (!end) {
			this.hand.putDown();
			this.placedDrag = { reminderId, from, at, overNew, target };
			return;
		}
		this.placedDrag = undefined;
		const face = places.placed(reminderId);
		if (!face) return;
		if (overNew) return this.copy(face);
		if (overTray(x, y)) return places.takeOff(reminderId);
		const rule = places.ruleAt?.(x, y, face);
		if (rule) return places.move(reminderId, from, { ruleId: rule });
		if (target && target !== from) places.move(reminderId, from, { seatId: target });
	}

	/** A placed token back to the tray (its trash, a ⋯ row). */
	takeOff(reminderId: string): void {
		this.hand.putDown();
		this.#places().takeOff(reminderId);
	}

	/** A drag given up (another finger, the browser took it). */
	cancel(): void {
		this.trayDrag = undefined;
		this.placedDrag = undefined;
		this.#places().hint?.(undefined, undefined);
	}

	/** The token in hand dropped where the area was tapped, as a drag let go there. */
	drop(x: number, y: number): void {
		const held = this.hand.held;
		if (!held) return;
		const given = { number: this.hand.number, look: this.hand.look };
		this.hand.putDown();
		if (held.kind === 'bank') this.dragTray(held.item, x, y, true, given);
		else this.dragPlaced(held.reminderId, held.from, x, y, true, true);
	}

	/** A seat tapped with a token in hand: it goes there. False when nothing is held. */
	dropOnSeat(seatId: string): boolean {
		const held = this.hand.held;
		if (!held) return false;
		const places = this.#places();
		const { number, look } = this.hand;
		this.hand.putDown();
		if (held.kind === 'bank') places.place(held.item, { seatId }, number, look);
		else if (held.from !== seatId) places.move(held.reminderId, held.from, { seatId });
		return true;
	}

	/** A tray token tapped: held (or put down), or "+ New token" makes one. */
	tap(item: BankItem): void {
		// Taken from the pulled-up tray, it lowers to its row, its tokens still there to see.
		this.open = false;
		if (!item.makesToken) return this.hand.toggle({ kind: 'bank', item });
		const held = this.hand.held;
		// Holding a token, "+ New token" takes it as a drop there does.
		if (held?.kind === 'bank')
			return this.copy(this.face(held.item, this.hand.number, { ...this.hand.look }));
		if (held?.kind === 'placed') {
			const face = this.#places().placed(held.reminderId);
			if (face) return this.copy(face);
		}
		this.makeToken();
	}

	/** Right-click (desktop): the token in hand, its ⋯ open. Touch keeps hold-to-drag. */
	menuFor(item: BankItem): void {
		if (item.makesToken) return;
		this.hand.hold({ kind: 'bank', item });
		this.hand.menuOpen = true;
	}

	/** A new ∞ token at the end of the tray's, opened to set its look. */
	makeToken(): void {
		const tokenId = this.#places().addToken();
		if (!tokenId) return;
		this.hand.putDown();
		this.editing = tokenId;
		this.fresh = true;
		this.editorOpen = true;
	}

	/** One of the tray's ∞ tokens opened to change its look (its ✎). */
	editToken(tokenId: string): void {
		this.hand.putDown();
		this.editing = tokenId;
		this.fresh = false;
		this.editorOpen = true;
	}

	/** Confirmed: a new token is in hand for the seat tapped next (Trevor, 2026-11-10, B). */
	confirmed(): void {
		if (!this.fresh || !this.editing) return;
		const item = genericStretch(this.#places().tokens()).find(
			(i) => i.token?.tokenId === this.editing
		);
		if (item) this.hand.hold({ kind: 'bank', item });
	}

	/**
	 * Duplicate (Trevor, 2026-11-10): a new ∞ token with this look, last in the tray, in hand
	 * for the seat tapped next.
	 */
	duplicate(look: GenericLook): void {
		const { tokenId: _id, ...own } = { tokenId: '', ...look };
		void _id;
		const tokenId = this.#places().addToken(own);
		if (!tokenId) return;
		const item = genericStretch(this.#places().tokens()).find((i) => i.token?.tokenId === tokenId);
		if (item) this.hand.hold({ kind: 'bank', item });
	}

	/** One of the tray's ∞ tokens copied (⋯ Duplicate token in the hand's pill). */
	duplicateToken(tokenId: string): void {
		const token = this.#places()
			.tokens()
			.find((t) => t.tokenId === tokenId);
		if (token) this.duplicate(token);
	}

	/** The editor's Delete: a new token is thrown away, another asks first. */
	editorDelete(): void {
		if (!this.editing) return;
		if (this.fresh) this.#places().removeToken(this.editing);
		else this.askDelete(this.editing);
	}

	/** Asks before one of the tray's ∞ tokens is thrown away, and its copies with it if wanted. */
	askDelete(tokenId: string): void {
		this.hand.putDown();
		this.deleting = tokenId;
		this.deleteOpen = true;
	}

	deleteConfirmed(withCopies: boolean): void {
		const tokenId = this.deleting;
		if (!tokenId) return;
		const places = this.#places();
		if (withCopies) for (const id of places.copiesOf(tokenId)) places.takeOff(id);
		places.removeToken(tokenId);
	}
}
