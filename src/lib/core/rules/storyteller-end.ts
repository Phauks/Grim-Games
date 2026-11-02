/**
 * The game's end when the Storyteller is executed (`ExecuteStoryteller`): a character in play,
 * even dead, may say who wins (`storyteller-executed`, the Atheist: good); otherwise evil wins
 * (https://wiki.bloodontheclocktower.com/Atheist).
 */
import type { EndsGame } from '#lib/core/data/game-end-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { DayLog, SeatId } from '#lib/core/model/types.ts';
import type { GameEnd } from './game-end.ts';

/** `logs`: every day log; `found`: the players whose character has the end, with it. */
export function storytellerExecuted(
	logs: readonly DayLog[],
	found: readonly { seatId: SeatId; characterId: CharacterId; rule: EndsGame }[],
	wiki: (characterId: CharacterId) => string
): GameEnd[] {
	const executed = logs
		.flatMap((log) => log.entries)
		.find((e) => e.kind === 'storyteller-execution');
	if (!executed) return [];
	const key = `storyteller-executed:${executed.entryId}`;
	const [first] = found;
	if (!first) {
		return [
			{
				key,
				rule: 'storyteller-executed',
				winner: 'evil',
				seats: [],
				wiki: 'https://wiki.bloodontheclocktower.com/Glossary',
				holds: []
			}
		];
	}
	return [
		{
			key,
			rule: 'storyteller-executed',
			winner: first.rule.winner ?? 'good',
			characterId: first.characterId,
			seats: found.map((f) => f.seatId),
			wiki: wiki(first.characterId),
			holds: []
		}
	];
}
