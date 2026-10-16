import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { warningText } from './board.ts';
import { DEFAULT_SEAT_LAYOUT, type SeatLayout } from '#lib/ui/seating/seat-layout.ts';
import { forgetUpsideDownMarks, pastNames, seatLayouts } from './device-notes.ts';

/**
 * The grimoire board's controller: runs commands on the open game and shows warnings and
 * refusals as toasts (overlays, so the board never moves), plus the device-only seat
 * layout.
 */
export class Grimoire {
	layout = $state.raw<SeatLayout>(DEFAULT_SEAT_LAYOUT);

	constructor(readonly open: OpenGame) {
		forgetUpsideDownMarks();
		this.layout = seatLayouts.read(open.game.gameId);
	}

	/**
	 * Night steps the Storyteller ticked off (`<night>:<step id>`). Kept while the game is
	 * open; the night order never ticks anything by itself.
	 */
	nightDone = $state.raw<readonly string[]>([]);

	toggleNightStep(key: string): void {
		this.nightDone = this.nightDone.includes(key)
			? this.nightDone.filter((k) => k !== key)
			: [...this.nightDone, key];
	}

	clearNight(): void {
		this.nightDone = [];
	}

	/** Changes where seats are drawn on this device; the seating order is untouched. */
	setLayout(layout: SeatLayout): void {
		this.layout = layout;
		seatLayouts.write(this.game.gameId, layout);
	}

	get game() {
		return this.open.game;
	}

	/** Runs a command; returns whether it was accepted. */
	run(command: Command): boolean {
		const result = this.open.run(command);
		if (!result.ok) {
			toast('Not done', result.error.message);
			return false;
		}
		for (const warning of result.warnings) {
			const text = warningText(warning);
			if (text) toast('Note', text);
		}
		return true;
	}

	rename(seatId: SeatId, name: string): void {
		if (this.run({ type: 'RenameSeat', seatId, playerName: name })) pastNames.remember(name);
	}

	/** Adds a seat at the end of the seating order; returns its id. */
	addSeat(): SeatId | undefined {
		const before = this.game.seating;
		if (!this.run({ type: 'AddSeat' })) return undefined;
		return this.game.seating.find((id) => !before.includes(id));
	}

	/** A Traveller joins: a new seat with the Traveller on it. */
	addTraveller(characterId: CharacterId, alignment: Alignment): SeatId | undefined {
		const seatId = this.addSeat();
		if (seatId === undefined) return undefined;
		if (!this.run({ type: 'AssignCharacter', seatId, characterId, alignment })) {
			this.open.undo();
			return undefined;
		}
		return seatId;
	}

	removeSeat(seatId: SeatId): void {
		this.run({ type: 'RemoveSeat', seatId });
	}
}
