import type { CharacterId } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import {
	seatNumber,
	type CharacterLookup,
	type DayEntry,
	type Game,
	type SeatId
} from '#lib/core/model/index.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { warningText } from '#lib/features/grimoire/board.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { describeEntry, type DayPort } from './day-port.ts';

/**
 * The day screen on a saved game: commands run on it and are saved; warnings and refusals
 * show as toasts, so nothing on the page moves.
 */
export class LiveDay implements DayPort {
	constructor(readonly open: OpenGame) {}

	get game(): Game {
		return this.open.game;
	}

	get characters(): CharacterLookup {
		return this.open.characters;
	}

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

	get canUndo(): boolean {
		return this.open.canUndo;
	}

	undo(): void {
		this.open.undo();
	}

	seatName(seatId: SeatId | undefined): string {
		if (seatId === undefined) return '';
		const name = this.game.seats[seatId]?.playerName;
		return name ?? `Seat ${seatNumber(this.game, seatId) ?? '?'}`;
	}

	characterName(id: CharacterId | undefined): string {
		return id === undefined ? '' : (this.characters.get(id)?.name ?? id);
	}

	describe(entry: DayEntry): string {
		return describeEntry(
			entry,
			(s) => this.seatName(s),
			(id) => this.characterName(id)
		);
	}
}
