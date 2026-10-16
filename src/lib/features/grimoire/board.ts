/**
 * Board helpers that are UI only: which characters the pickers offer and the text shown
 * for engine warnings. Rules stay in `#lib/core`; where seats sit is `#lib/ui/seating`.
 */
import type { Character, CharacterType, Script } from '#lib/core/data/index.ts';
import type { EngineWarning } from '#lib/core/engine/index.ts';
import type { DeathCauseFlag } from '#lib/core/rules/index.ts';
import {
	isOnScript,
	scriptCharacterIds,
	type CharacterLookup,
	type DeathCause,
	type Game,
	type Seat,
	type SeatId
} from '#lib/core/model/index.ts';

/** The types offered for a seat, in script-sheet order. */
export const SEAT_TYPES: readonly CharacterType[] = [
	'townsfolk',
	'outsider',
	'minion',
	'demon',
	'traveller'
];

export interface CharacterGroup {
	type: CharacterType;
	characters: Character[];
}

/**
 * Characters for a picker, grouped by type. With `all` false only the script's characters
 * are offered, plus every Traveller (Travellers can join any game). Each group keeps
 * script order, then name order for characters off the script.
 */
export function pickerGroups(
	characters: CharacterLookup,
	script: Script,
	types: readonly CharacterType[],
	all: boolean
): CharacterGroup[] {
	const order = new Map(scriptCharacterIds(script).map((id, i) => [id, i]));
	const rank = (c: Character) => order.get(c.id) ?? Number.MAX_SAFE_INTEGER;
	const pool = [...characters.values()].filter(
		(c) =>
			all || order.has(c.id) || c.type === 'traveller' || c.type === 'fabled' || c.type === 'loric'
	);
	return types
		.map((type) => ({
			type,
			characters: pool
				.filter((c) => c.type === type)
				.sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name))
		}))
		.filter((group) => group.characters.length > 0);
}

/**
 * The orphan warning: a seat whose character token is not on the game's script (Travellers
 * never are, so they are not orphans).
 */
export function isOrphan(seat: Seat, script: Script, characters: CharacterLookup): boolean {
	if (seat.characterId === undefined) return false;
	const character = characters.get(seat.characterId);
	if (!character) return true;
	return character.type !== 'traveller' && !isOnScript(script, seat.characterId);
}

/** A cause's words. Travellers are exiled rather than executed. */
export function causeLabel(
	cause: DeathCause | undefined,
	characters: CharacterLookup,
	traveller = false
): string {
	switch (cause) {
		case undefined:
			return 'None';
		case 'execution':
			return traveller ? 'Exiled' : 'Executed';
		case 'exile':
			return 'Exiled';
		case 'demon':
			return 'The Demon';
		case 'other':
			return 'Something else';
		default:
			return characters.get(cause)?.name ?? cause;
	}
}

/**
 * Why a death cause is offered with a caution, for the overlay behind its marker. Uses
 * player names (or "Seat N") and character names only; the rule itself is core's.
 */
export function causeFlagText(
	flag: DeathCauseFlag,
	game: Game,
	characters: CharacterLookup,
	victim: string
): string {
	const name = (seatId: SeatId) =>
		game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;
	switch (flag.code) {
		case 'registers': {
			const by = characters.get(flag.source.characterId)?.name ?? flag.source.characterId;
			return `Only if ${victim} registered falsely (${by}).`;
		}
		case 'impaired':
			return `${flag.seatIds.map(name).join(', ')} ${flag.seatIds.length === 1 ? 'is' : 'are'} drunk, poisoned or without an ability now.`;
		case 'unknown':
			return `${victim}'s alignment or character is not set, so this can't be checked.`;
	}
}

/** What a toast says for a warning the Storyteller went ahead with. */
export function warningText(warning: EngineWarning): string | undefined {
	switch (warning.code) {
		case 'no-change':
			return undefined;
		case 'not-on-script':
			return 'That character is not on the script.';
		case 'already-in-play':
			return 'That character is already on another seat.';
		case 'kept-alignment':
			return 'The seat kept its alignment. Change it in the seat sheet if needed.';
		case 'seat-has-character':
			return 'The removed seat had a character.';
		case 'ghost-vote-while-alive':
			return 'That player is alive.';
		default:
			return warning.message;
	}
}
