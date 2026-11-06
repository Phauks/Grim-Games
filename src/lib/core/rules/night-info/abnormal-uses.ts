/**
 * Night information: the abilities that worked abnormally since dawn, for the Mathematician
 * (https://wiki.bloodontheclocktower.com/Mathematician), and what the counting character's
 * jinxes add to them (`abnormalCounts`, `data/jinx-rules.ts`). Part of `night-info.ts`.
 */
import type { AbnormalCounts } from '#lib/core/data/jinx-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { AbnormalCause, DayEntry, Game, SeatId } from '#lib/core/model/types.ts';
import { ownJinxEffects } from '../jinxes.ts';
import type { AbnormalUse } from './reliability.ts';

/** The partners whose jinx with `counter` says how they count (`abnormalCounts`). */
function countedPartners(
	game: Game,
	counter: CharacterId | undefined,
	how: AbnormalCounts,
	characters: CharacterLookup
): CharacterId[] {
	if (counter === undefined) return [];
	return ownJinxEffects(game, counter, 'abnormalCounts', characters, (e) => e.counts === how).map(
		(j) => j.partner
	);
}

/**
 * Every ability that worked abnormally since dawn because of another character, from the
 * night info the Storyteller recorded (its `abnormal` causes), one per player and
 * character. The Mathematician's own ability does not count, nor does a cause that is the
 * player's own ability: the info's character, or their true character on their own seat (the
 * Drunk's or the Marionette's false info is their own doing, not another character's,
 * https://wiki.bloodontheclocktower.com/Mathematician). `counter`, the counting character,
 * counts those its jinx names (`abnormalCounts` `self-caused`: the Mathematician's Drunk and
 * Marionette). The day log runs from the last "New day", which the Storyteller presses at dawn.
 */
export function abnormalSinceDawn(
	game: Game,
	characters: CharacterLookup,
	counter?: CharacterId
): AbnormalUse[] {
	const out: AbnormalUse[] = [];
	const counted = countedPartners(game, counter, 'self-caused', characters);
	const key = (c: AbnormalCause) => `${c.reason}:${c.characterId ?? ''}:${c.seatId ?? ''}`;
	const own = (e: Extract<DayEntry, { kind: 'info' }>, c: AbnormalCause) =>
		c.seatId === e.seatId &&
		(c.characterId === e.characterId ||
			(c.characterId !== undefined &&
				characters !== undefined &&
				c.characterId === trueCharacter(game, e.seatId, characters) &&
				!counted.includes(c.characterId)));
	const entries = game.today.entries.filter(
		(e): e is Extract<DayEntry, { kind: 'info' }> => e.kind === 'info'
	);
	for (const e of entries) {
		// The counting ability's own information does not count (the Mathematician's).
		if (rulesOf(e.characterId, characters)?.answers?.question === 'abnormal-abilities') continue;
		const causes = (e.abnormal ?? []).filter((c) => !own(e, c));
		if (causes.length === 0) continue;
		const use = out.find((u) => u.seatId === e.seatId && u.characterId === e.characterId);
		if (!use) {
			out.push({
				seatId: e.seatId,
				characterId: e.characterId,
				causes: [...causes],
				entryIds: [e.entryId]
			});
			continue;
		}
		use.entryIds.push(e.entryId);
		for (const c of causes) if (!use.causes.some((d) => key(d) === key(c))) use.causes.push(c);
	}
	return out;
}

/**
 * The uses `counter`'s `unlike-demon` jinxes add (the Mathematician learns if the Lunatic
 * attacked a different player than the real Demon,
 * https://wiki.bloodontheclocktower.com/Mathematician#Related_Jinxes): each partner's player
 * whose `choosesLikeDemon` reminder is on none of the players a Demon killed since dawn (`died`,
 * with a Demon as their death cause). With nobody killed by a Demon the app can't tell whom the
 * Demon attacked, so it adds nothing: the Storyteller's Abnormal reminders decide.
 */
export function demonChoiceUses(
	game: Game,
	counter: CharacterId,
	characters: CharacterLookup,
	died: readonly SeatId[]
): AbnormalUse[] {
	const victims = died.filter((s) => {
		const seat = game.seats[s];
		const cause = seat?.deathCause;
		return (
			seat?.dead &&
			(cause === 'demon' || (cause !== undefined && characters.get(cause)?.type === 'demon'))
		);
	});
	if (victims.length === 0) return [];
	return countedPartners(game, counter, 'unlike-demon', characters).flatMap((partner) => {
		const label = rulesOf(partner, characters)?.choosesLikeDemon;
		if (!label) return [];
		return game.seating.flatMap((seatId): AbnormalUse[] => {
			if (trueCharacter(game, seatId, characters) !== partner) return [];
			const chosen = game.seating.filter((s) =>
				game.seats[s].reminders.some((r) => r.characterId === partner && r.label === label)
			);
			if (chosen.length === 0 || victims.some((v) => chosen.includes(v))) return [];
			return [
				{
					seatId,
					characterId: partner,
					causes: [{ reason: 'other', characterId: partner, seatId }],
					entryIds: []
				}
			];
		});
	});
}
