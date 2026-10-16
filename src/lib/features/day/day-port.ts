import type { CharacterId } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import type { CharacterLookup, DayEntry, Game, SeatId } from '#lib/core/model/index.ts';

/**
 * What the day screen needs from a game: the real saved game (`LiveDay`) or the day spike's
 * sample (`DayGame`). `run` shows warnings and refusals as toasts and says whether it ran.
 */
export interface DayPort {
	readonly game: Game;
	readonly characters: CharacterLookup;
	run(command: Command): boolean;
	seatName(seatId: SeatId | undefined): string;
	characterName(id: CharacterId | undefined): string;
	describe(entry: DayEntry): string;
}

/** A short line for a day-log entry, in our words. */
export function describeEntry(
	entry: DayEntry,
	seatName: (seatId: SeatId | undefined) => string,
	characterName: (id: CharacterId | undefined) => string
): string {
	const already = (died: boolean) => (died ? '' : ' (already dead)');
	switch (entry.kind) {
		case 'nomination':
			return `${seatName(entry.nominator)} nominated ${seatName(entry.nominee)}`;
		case 'execution':
			return `${seatName(entry.seatId)} executed${already(entry.died)}`;
		case 'exile':
			return `${seatName(entry.seatId)} exiled${already(entry.died)}`;
		case 'ability':
			return `${characterName(entry.characterId)} (${seatName(entry.seatId)}) used their ability`;
		case 'note': {
			const who = entry.seatId ? ` (${seatName(entry.seatId)})` : '';
			const guesses = entry.guesses?.length
				? ` · ${entry.guesses.length} guess${entry.guesses.length === 1 ? '' : 'es'}`
				: '';
			return `${characterName(entry.characterId)}${who}: ${entry.text}${guesses}`;
		}
		case 'info':
			return `${characterName(entry.characterId)} (${seatName(entry.seatId)}): ${entry.text}`;
	}
}
