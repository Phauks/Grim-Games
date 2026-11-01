/**
 * Tokens an execution death puts on the board by itself (`afterExecution` in a rules block):
 * the Minstrel's Everyone Is Drunk when a Minion dies by execution
 * (https://wiki.bloodontheclocktower.com/Minstrel). Only a death by execution counts (the
 * Virgin's nominator's too, `isExecution`), never a Traveller's exile, and only while the
 * character's player is alive and its ability works. The Storyteller can take the token off.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { DeathCause, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { isExecution } from './death-causes.ts';

/** One token to place, on the seat of the character whose ability it is. */
export interface AfterExecutionToken {
	seatId: SeatId;
	characterId: CharacterId;
	label: ReminderLabel;
}

/**
 * The tokens to place when the living players `deaths` die, each by its cause, given the game
 * before they died. Each token once, and none already on its seat.
 */
export function afterExecutionTokens(
	game: Game,
	deaths: readonly { seatId: SeatId; cause: DeathCause | undefined }[],
	characters: CharacterLookup
): AfterExecutionToken[] {
	const executed = deaths.filter(
		(d) => game.seats[d.seatId]?.dead === false && isExecution(d.cause, characters)
	);
	if (executed.length === 0) return [];
	const dying = new Set(deaths.map((d) => d.seatId));
	const out: AfterExecutionToken[] = [];
	for (const seatId of game.seating) {
		const characterId = trueCharacter(game, seatId, characters);
		const rule = characterId && rulesOf(characterId, characters)?.afterExecution;
		if (!characterId || !rule || dying.has(seatId) || game.seats[seatId]?.dead) continue;
		if (!executed.some((d) => typeOf(game, d.seatId, characters) === rule.of)) continue;
		if (!abilityState(game, seatId, characters).works) continue;
		const placed = game.seats[seatId].reminders.some(
			(r) => r.characterId === characterId && r.label === rule.token
		);
		if (!placed) out.push({ seatId, characterId, label: rule.token });
	}
	return out;
}
