/**
 * Board helpers that are UI only: where seats sit, how big tokens are, which characters
 * the pickers offer, and the text shown for engine warnings. Rules stay in `#lib/core`.
 */
import type { Character, CharacterId, CharacterType, Script } from '#lib/core/data/index.ts';
import type { EngineWarning } from '#lib/core/engine/index.ts';
import type { DeathCauseOption } from '#lib/core/rules/index.ts';
import {
	GENERAL_DEATH_CAUSES,
	isOnScript,
	scriptCharacterIds,
	type CharacterLookup,
	type DeathCause,
	type Seat
} from '#lib/core/model/index.ts';

/**
 * A seat's centre on an ellipse filling the board, as percentages of its width and height.
 * Seat 1 is at the top and seating runs clockwise. Positions are not stored: they follow
 * the seating order, so rotation and other screen sizes just work.
 */
export function seatPosition(index: number, count: number): { x: number; y: number } {
	const angle = (index / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2;
	return { x: 50 + 41 * Math.cos(angle), y: 50 + 41 * Math.sin(angle) };
}

/**
 * Token size in px for `count` seats on a board of `width` × `height`: as large as fits
 * round the ellipse without overlapping, between a 44px tap target and 96px.
 */
export function tokenSize(width: number, height: number, count: number): number {
	if (width <= 0 || height <= 0) return 56;
	// Perimeter of the seat ellipse (Ramanujan), shared out between the seats, leaving room
	// for the name under each token.
	const a = 0.41 * width;
	const b = 0.41 * height;
	const h = ((a - b) / (a + b)) ** 2;
	const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
	const perSeat = perimeter / Math.max(count, 1);
	const bySpacing = perSeat * 0.72;
	const byBoard = Math.min(width, height) * 0.2;
	return Math.round(Math.max(44, Math.min(96, bySpacing, byBoard)));
}

/** The types offered for a seat, in script-sheet order. */
export const SEAT_TYPES: readonly CharacterType[] = [
	'townsfolk',
	'outsider',
	'minion',
	'demon',
	'traveller'
];

export const TYPE_LABELS: Record<CharacterType, string> = {
	townsfolk: 'Townsfolk',
	outsider: 'Outsiders',
	minion: 'Minions',
	demon: 'Demons',
	traveller: 'Travellers',
	fabled: 'Fabled',
	loric: 'Loric'
};

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

/**
 * The death-cause picker's choices: executed and the Demon first, then the characters that
 * can cause a death (core `gameDeathCauses`, in script order) and something else last.
 * Demons are left out because "the Demon" covers them; a character that can only cause its
 * own death is offered only on the seat that has it.
 */
export function deathCauseOptions(
	options: readonly DeathCauseOption[],
	characters: CharacterLookup,
	ownCharacter?: CharacterId
): DeathCause[] {
	const ids = options
		.filter(({ characterId, kind }) => {
			if (characters.get(characterId)?.type === 'demon') return false;
			return kind !== 'own-death' || characterId === ownCharacter;
		})
		.map(({ characterId }) => characterId);
	const [execution, demon, other] = GENERAL_DEATH_CAUSES;
	return [execution, demon, ...ids, other];
}

export function causeLabel(cause: DeathCause | undefined, characters: CharacterLookup): string {
	switch (cause) {
		case undefined:
			return 'None';
		case 'execution':
			return 'Executed';
		case 'demon':
			return 'The Demon';
		case 'other':
			return 'Something else';
		default:
			return characters.get(cause)?.name ?? cause;
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
