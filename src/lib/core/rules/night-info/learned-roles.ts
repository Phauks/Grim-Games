/**
 * Night information: the roles a "learn a role" character could be shown (Washerwoman,
 * Librarian, Investigator: two players, one of them a character of a type), as rows the
 * Storyteller shows with one tap (Trevor, 2026-10-25). Part of `night-info.ts`.
 *
 * Built on the picker's valid information, with two additions:
 * - the board: the character's own reminders mark a choice made earlier (the Investigator's
 *   Minion and Wrong, put on during setup), and that row comes first;
 * - a player who registers as the type without being it (the Recluse to the Investigator, the
 *   Spy to the Washerwoman) is a row of its own whose character the Storyteller picks from
 *   `characterIds`.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { type CharacterLookup, scriptCharacterIds } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { type InfoPicker, type ValidReason, validInformation } from './picker.ts';

/** Why a row may be shown: a valid reason, or `invalid` for a marked choice that isn't. */
export type LearnedRoleReason = ValidReason | 'invalid';

/** One role the waking player could be shown, and the players pointed at with it. */
export interface LearnedRole {
	/** The player who is the character shown, or who registers as it. */
	target: SeatId;
	/** The character shown, or, when several, the ones the Storyteller may pick from. */
	characterIds: CharacterId[];
	/** The second player, when the board marks one; otherwise any other player. */
	other?: SeatId;
	reason: LearnedRoleReason;
	/** For `registers`: the players who would register as something else. */
	registered?: SeatId[];
	/** The character's reminders on the board mark this row (put on during setup). */
	marked?: true;
}

export interface LearnedRoles {
	rows: LearnedRole[];
	/** "None in play" is valid (the Librarian with no Outsiders), and why. */
	none?: ValidReason;
	/** Any other choice is valid too: the waking player is droisoned, or the Vortox. */
	anyOther?: ValidReason;
}

/** The seat carrying `label` of the picker's character, if any. */
function markedSeat(game: Game, picker: InfoPicker, label: string | undefined): SeatId | undefined {
	if (!label) return undefined;
	return game.seating.find((s) =>
		game.seats[s].reminders.some((r) => r.characterId === picker.characterId && r.label === label)
	);
}

/**
 * The rows for a `pair-character` picker, marked first, then true, then by registration;
 * undefined for other pickers. The app lists them all and never picks one (Trevor,
 * 2026-10-18: "show all valid information").
 */
export function learnedRoles(
	game: Game,
	picker: InfoPicker,
	characters: CharacterLookup
): LearnedRoles | undefined {
	if (picker.kind !== 'pair-character') return undefined;
	const valid = validInformation(game, picker);
	const rows: LearnedRole[] = [];
	let none: ValidReason | undefined;
	let anyOther: ValidReason | undefined;
	for (const v of valid) {
		if (v.none) none = v.reason;
		else if (v.anyOther) anyOther = v.reason;
		else if (v.target && v.characterIds?.length) {
			rows.push({
				target: v.target,
				characterIds: v.characterIds,
				reason: v.reason,
				...(v.registered ? { registered: v.registered } : {})
			});
		}
	}

	const target = markedSeat(game, picker, picker.reminders.target);
	const other = markedSeat(game, picker, picker.reminders.other);
	if (target) {
		const at = rows.findIndex((r) => r.target === target);
		const mark = (row: LearnedRole): LearnedRole => ({
			...row,
			marked: true,
			...(other && other !== target ? { other } : {})
		});
		if (at >= 0) {
			rows.unshift(mark(rows.splice(at, 1)[0]));
		} else {
			// Marked on a player who isn't that type: allowed when any info is, else shown
			// as not valid (the Storyteller overrides anything; warn, never lock).
			const id = trueCharacter(game, target, characters);
			const ofType = scriptCharacterIds(game.script).filter(
				(c) => characters.get(c)?.type === picker.characterType
			);
			rows.unshift(
				mark({
					target,
					characterIds: ofType.length > 0 ? ofType : id ? [id] : [],
					reason: anyOther ?? 'invalid'
				})
			);
		}
	}
	return {
		rows,
		...(none ? { none } : {}),
		...(anyOther ? { anyOther } : {})
	};
}
