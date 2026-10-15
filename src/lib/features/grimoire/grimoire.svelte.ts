import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { warningText } from './board.ts';
import { pastNames, upsideDown } from './device-notes.ts';

/**
 * The grimoire board's controller: runs commands on the open game and shows warnings and
 * refusals as toasts (overlays, so the board never moves), plus the device-only
 * upside-down marks.
 */
export class Grimoire {
	flipped = $state<SeatId[]>([]);

	constructor(readonly open: OpenGame) {
		this.flipped = upsideDown.read(open.game.gameId);
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

	isFlipped(seatId: SeatId): boolean {
		return this.flipped.includes(seatId);
	}

	toggleFlipped(seatId: SeatId): void {
		this.flipped = this.isFlipped(seatId)
			? this.flipped.filter((id) => id !== seatId)
			: [...this.flipped, seatId];
		upsideDown.write(this.game.gameId, this.flipped);
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

	/** The seat's upside-down mark is kept, so undo brings the seat back as it was. */
	removeSeat(seatId: SeatId): void {
		this.run({ type: 'RemoveSeat', seatId });
	}
}
