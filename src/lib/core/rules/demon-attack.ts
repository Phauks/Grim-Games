/**
 * M15a: a rule that lets the Demon choose not to attack (`demonAttack` in a rules block: the
 * Toymaker, https://wiki.bloodontheclocktower.com/Toymaker). While a character with it is in
 * play, the Demon's night step offers No attack. With `mustSkipOnce` the Demon has to do so at
 * least once per game: its reminder marks the Demon until it has (taking it off records the
 * choice, as the wiki's How to Run does), and while it is still on the Demon the Storyteller is
 * reminded; on a night the Demon's attack could end the game, the Demon doesn't wake or attack.
 * Warns only: the Storyteller decides (`night-alerts.ts` shows these at the step).
 */
import { rulesIn } from '#lib/core/data/rules/index.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { aliveNonTravellers } from './game-end.ts';

/** The rule in play: whose it is, and the reminder marking a Demon yet to skip, if any. */
export interface DemonAttackRule {
	characterId: CharacterId;
	mustSkipOnce?: ReminderLabel;
}

/** The first character in play (a Fabled or Loric, or a player's) whose rules let the Demon skip. */
export function demonAttackRule(
	game: Game,
	characters: CharacterLookup
): DemonAttackRule | undefined {
	const ids = new Set<CharacterId>(game.ruleCharacters);
	for (const s of game.seating) {
		const id = trueCharacter(game, s, characters);
		if (id) ids.add(id);
	}
	for (const characterId of ids) {
		const rule = rulesIn(game, characterId, characters)?.demonAttack;
		if (rule)
			return {
				characterId,
				...(rule.mustSkipOnce ? { mustSkipOnce: rule.mustSkipOnce } : {})
			};
	}
	return undefined;
}

/**
 * Whether the Demon's attack tonight could end the game: with 3 players alive (not counting
 * Travellers), one more death leaves the 2 that end it.
 */
export function attackCouldEndGame(game: Game, characters: CharacterLookup): boolean {
	return aliveNonTravellers(game, characters).length <= 3;
}

/** What the rule means for the Demon in `seatId` tonight. */
export interface NoAttackState {
	rule: DemonAttackRule;
	/** The `mustSkipOnce` reminder still on this Demon: it hasn't chosen not to attack yet. */
	pending?: ReminderId;
	/** Still pending on a night its attack could end the game: it doesn't wake or attack. */
	finalNight: boolean;
}

/** The rule's state for a Demon's seat; none for other players or with no such rule in play. */
export function noAttackState(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): NoAttackState | undefined {
	if (typeOf(game, seatId, characters) !== 'demon') return undefined;
	const rule = demonAttackRule(game, characters);
	if (!rule) return undefined;
	const pending = rule.mustSkipOnce
		? game.seats[seatId]?.reminders.find(
				(r) => r.characterId === rule.characterId && r.label === rule.mustSkipOnce
			)?.reminderId
		: undefined;
	return {
		rule,
		...(pending ? { pending } : {}),
		finalNight: pending !== undefined && attackCouldEndGame(game, characters)
	};
}
