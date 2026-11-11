/**
 * Tokens an execution death puts on the board by itself (`afterExecution` in a rules block):
 * on the ability's own player, the Minstrel's Everyone Is Drunk when a Minion dies by
 * execution (https://wiki.bloodontheclocktower.com/Minstrel); on the executed player, the
 * Undertaker's Died Today, the Cannibal's Lunch or the Leviathan's Good Player Executed. With
 * `when: day`, any death during the day counts, not only an execution (the Godfather's and
 * Zombuul's Died Today after a Slayer's shot).
 * Only a death by execution counts (the Virgin's nominator's too, `isExecution`), never a
 * Traveller's exile, and only while the character's player is alive (or acts when dead); a
 * token on its own player also needs its ability to work. The Storyteller can take the token
 * off or move it.
 */
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { DeathCause, Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { isExecution } from './death-causes.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/**
 * One token to place on `seatId`, the ability's own player's or the executed player's. With
 * `moveId`, the ability's token already on the board moves there instead; with `removeId`,
 * that token comes off (`marksSelf` after a lunch of the other alignment).
 */
export type AfterExecutionToken =
	| { seatId: SeatId; characterId: CharacterId; label: ReminderLabel; moveId?: ReminderId }
	| { removeId: ReminderId };

/**
 * The tokens to place when the living players `deaths` die, each by its cause (and `day` when
 * the board marked it during the day), given the game before they died. Each token once; a token on its own player is not added again, and one
 * on an executed player is added only while none is out, or moved with `moves`.
 */
export function afterExecutionTokens(
	game: Game,
	deaths: readonly { seatId: SeatId; cause: DeathCause | undefined; day?: true }[],
	characters: CharacterLookup
): AfterExecutionToken[] {
	const living = deaths.filter((d) => game.seats[d.seatId]?.dead === false);
	const executed = living.filter((d) => isExecution(d.cause, characters));
	// Any death the board marked during the day; never the Demon's kill, which is at night.
	const byDay = living.filter(
		(d) => isExecution(d.cause, characters) || (d.day && d.cause !== 'demon')
	);
	if (byDay.length === 0) return [];
	const dying = new Set(deaths.map((d) => d.seatId));
	const out: AfterExecutionToken[] = [];
	for (const seatId of game.seating) {
		const characterId = trueCharacter(game, seatId, characters);
		const rules = characterId ? rulesFor(game, characterId, characters) : undefined;
		const rule = rules?.afterExecution;
		if (!characterId || !rule) continue;
		if (game.seats[seatId]?.dead && !rules?.actsWhenDead) continue;
		if (!rule.on && dying.has(seatId)) continue;
		const fits = (rule.when === 'day' ? byDay : executed).filter(
			(d) =>
				(!rule.of || typeOf(game, d.seatId, characters) === rule.of) &&
				(!rule.alignment || alignmentOf(game, d.seatId) === rule.alignment)
		);
		if (fits.length === 0) continue;
		// A token on the executed player only records who it was, for the ability to read later
		// (when its own state counts); one on its own player is the ability's effect.
		if (!rule.on && !abilityState(game, seatId, characters).works) continue;
		const own = (s: SeatId) =>
			game.seats[s].reminders.filter(
				(r) => r.characterId === characterId && r.label.toLowerCase() === rule.token.toLowerCase()
			);
		if (!rule.on) {
			if (own(seatId).length === 0) out.push({ seatId, characterId, label: rule.token });
			continue;
		}
		const target = fits.at(-1)!.seatId;
		const placed = game.seating.flatMap((s) => own(s).map((r) => ({ s, r })));
		if (placed.some(({ s }) => s === target)) continue;
		if (placed.length > 0 && !rule.moves) continue;
		out.push({
			seatId: target,
			characterId,
			label: rule.token,
			...(placed.length > 0 ? { moveId: placed[0].r.reminderId } : {})
		});
		if (rule.marksSelf) {
			const { token, alignment } = rule.marksSelf;
			const mine = game.seats[seatId].reminders.filter(
				(r) => r.characterId === characterId && r.label.toLowerCase() === token.toLowerCase()
			);
			if (alignmentOf(game, target) === alignment) {
				if (mine.length === 0) out.push({ seatId, characterId, label: token });
			} else for (const r of mine) out.push({ removeId: r.reminderId });
		}
	}
	return out;
}
