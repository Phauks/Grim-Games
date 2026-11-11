/**
 * A seat's player name, edited in place in the seat sheet's header, with suggestions from
 * the room's phones (Trevor, 2026-10-26). SeatNameField draws the field, SeatNameSuggestions
 * the names to pick from.
 */
import type { SeatId } from '#lib/core/model/index.ts';
import { roomHost } from '#lib/features/room/host.svelte.ts';
import { suggestNames } from '#lib/features/grimoire/device-notes.ts';
import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';

interface NameSource {
	grimoire(): Grimoire;
	seatId(): SeatId | undefined;
	/** Whether the sheet is open: closing it ends the edit. */
	open(): boolean;
}

export class SeatNameEdit {
	#source: NameSource;
	#seat = $derived.by(() => {
		const id = this.#source.seatId();
		return id === undefined ? undefined : this.#source.grimoire().game.seats[id];
	});
	/** The seat's saved name, if any. */
	get saved(): string | undefined {
		return this.#seat?.playerName;
	}
	/** What the field holds. A different seat (or the same seat renamed elsewhere) resets it. */
	typed = $derived(this.#seat?.playerName ?? '');
	/** The input has taken the name's spot. */
	editing = $state(false);
	#taken = $derived.by(() => {
		const game = this.#source.grimoire().game;
		const seatId = this.#source.seatId();
		return game.seating.flatMap((id) =>
			id !== seatId && game.seats[id].playerName ? [game.seats[id].playerName!] : []
		);
	});
	// The room's phones without a seat in this game, asleep too, never names from earlier games.
	#inRoom = $derived(roomHost().unseatedInGame.flatMap((m) => (m.name ? [m.name] : [])));
	readonly suggestions = $derived(suggestNames(this.#inRoom, this.typed, this.#taken));

	constructor(source: NameSource) {
		this.#source = source;
		$effect(() => {
			if (!source.open()) this.editing = false;
		});
	}

	edit(): void {
		this.typed = this.#seat?.playerName ?? '';
		this.editing = true;
	}

	/** Saves the name and closes the keyboard (focus leaving the field closes it). */
	finish(name = this.typed): void {
		if (!this.editing) return;
		this.#commit(name);
		this.editing = false;
	}

	/** Escape leaves the name as it was, and does not also close the sheet. */
	cancel(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		this.typed = this.#seat?.playerName ?? '';
		this.editing = false;
	}

	#commit(name: string): void {
		const seatId = this.#source.seatId();
		if (!seatId || (this.#seat?.playerName ?? '') === name.trim()) return;
		this.#source.grimoire().rename(seatId, name);
		this.typed = name.trim();
	}
}
