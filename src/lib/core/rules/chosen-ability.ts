/**
 * The ability a player chooses to gain by their character's `gainedFrom.choose` rule (the
 * Philosopher's good character, https://wiki.bloodontheclocktower.com/Philosopher), picked on
 * their night step:
 * - a character in play: its player carries the gaining character's `token` (the Drunk), and the
 *   gaining player has that player's ability by `gainedBy`;
 * - any other: the gaining player holds it (`Seat.abilities`, via their own character) and keeps
 *   their token, so the board still shows who they are (Trevor, 2026-11-03, option A). The wiki's
 *   own way, a swapped token with its "Is The" reminder, still counts too (`gainedBy`).
 */
import type { GainedFrom } from '#lib/core/data/gained-from-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { gainedBy } from './gained-abilities.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/** `via`'s rule when its player chooses the ability they gain. */
export function choosesAbility(
	game: Game,
	via: CharacterId,
	characters: CharacterLookup
): (GainedFrom & { choose: NonNullable<GainedFrom['choose']> }) | undefined {
	const rule = rulesFor(game, via, characters)?.gainedFrom;
	return rule?.choose ? { ...rule, choose: rule.choose } : undefined;
}

export interface ChosenAbility {
	characterId: CharacterId;
	/** The player whose character it is, made drunk by the choice; unset when not in play. */
	fromSeat?: SeatId;
}

/** What `holder` chose by `via`'s rule so far, if anything. */
export function chosenAbility(
	game: Game,
	holder: SeatId,
	via: CharacterId,
	characters: CharacterLookup
): ChosenAbility | undefined {
	const rule = choosesAbility(game, via, characters);
	if (!rule) return undefined;
	const held = game.seats[holder]?.abilities?.find((a) => a.via === via);
	if (held) return { characterId: held.characterId };
	const gained = gainedBy(game, holder, via, rule, characters);
	if (!gained) return undefined;
	return {
		characterId: gained.characterId,
		...(gained.fromSeat !== undefined ? { fromSeat: gained.fromSeat } : {})
	};
}

/** The changes a choice makes: what it takes back first, then what it records. */
export interface AbilityChoicePlan {
	/** The ability held by an earlier choice, taken back. */
	dropHeld?: CharacterId;
	/** The `token` reminders of an earlier choice, taken off. */
	dropReminders: ReminderId[];
	/** The player of the chosen character in play, who gets `token`. */
	tokenOn?: SeatId;
	/** The chosen character not in play, held by `holder`. */
	hold?: CharacterId;
}

/**
 * The changes `holder` choosing `characterId` (or nothing) makes by `via`'s rule. An earlier
 * choice is taken back first, so choosing again replaces it.
 */
export function abilityChoice(
	game: Game,
	holder: SeatId,
	via: CharacterId,
	characterId: CharacterId | undefined,
	characters: CharacterLookup
): AbilityChoicePlan | undefined {
	const rule = choosesAbility(game, via, characters);
	if (!rule) return undefined;
	const dropHeld = game.seats[holder]?.abilities?.find((a) => a.via === via)?.characterId;
	const dropReminders = game.seating.flatMap((s) =>
		game.seats[s].reminders
			.filter((r) => r.characterId === via && r.label === rule.token)
			.map((r) => r.reminderId)
	);
	const plan: AbilityChoicePlan = {
		...(dropHeld !== undefined ? { dropHeld } : {}),
		dropReminders
	};
	if (characterId === undefined) return plan;
	const player = game.seating.find(
		(s) => s !== holder && trueCharacter(game, s, characters) === characterId
	);
	return player !== undefined ? { ...plan, tokenOn: player } : { ...plan, hold: characterId };
}
