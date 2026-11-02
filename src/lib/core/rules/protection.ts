/**
 * Protection: abilities that stop a player dying (the Monk, Soldier, Tea Lady, Pacifist and
 * others), and those that save a player from an execution or an exile. Split from ability.ts,
 * which re-exports it.
 */
import { type CharacterId, type ReminderLabel } from '#lib/core/data/types.ts';
import type { PROTECTS_FROM, Protects } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { type CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, aliveNeighbours, getSeat, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, seatOfCharacter, type AbilitySource } from './ability.ts';

/** One ability that protects a player from a kill, and the reminder that says so if any. */
export interface Protector {
	source: AbilitySource;
	/**
	 * Against the Demon's kill only, any death, an execution only, all but an execution, any
	 * death by day, or an exile only.
	 */
	from: (typeof PROTECTS_FROM)[number];
}

/**
 * What a death is from: the Demon's kill, another ability's at night, the day's execution,
 * another ability's by day (`day`: a Slayer's shot, a Witch's curse, recorded while it is day),
 * or a Traveller's exile, which is not an execution
 * (https://wiki.bloodontheclocktower.com/Exile).
 */
export type DeathBy = 'demon' | 'other' | 'execution' | 'day' | 'exile';

/** Whether a protection stops a death `by` this: one lasting only the night stops none by day. */
function stops(rule: Protects, by: DeathBy): boolean {
	const byDay = by === 'execution' || by === 'day' || by === 'exile';
	const covers =
		rule.from === 'any' ||
		rule.from === by ||
		(rule.from === 'not-execution' && by !== 'execution') ||
		(rule.from === 'day' && byDay);
	return covers && !(rule.night && byDay);
}

/**
 * The protection `characterId` gives `seatId`, if its rule covers that player: its own
 * player (`self`), the player its token marks (`marked`), or any good player (`good`).
 */
function protectionFor(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	rule: Protects,
	characters: CharacterLookup
): AbilitySource | undefined {
	const seat = getSeat(game, seatId);
	if (!seat) return undefined;
	const from = seatOfCharacter(game, characterId, characters);
	if (rule.whileNeighboursGood) {
		const near = from === undefined ? [] : aliveNeighbours(game, from);
		if (near.length === 0 || near.some((id) => alignmentOf(game, id) !== 'good')) return undefined;
	}
	switch (rule.who) {
		case 'self':
			return trueCharacter(game, seatId, characters) === characterId
				? { characterId, seatId }
				: undefined;
		case 'good':
			return alignmentOf(game, seatId) === 'good'
				? { characterId, ...(from ? { seatId: from } : {}) }
				: undefined;
		case 'marked': {
			const token = rule.token.toLowerCase();
			const r = seat.reminders.find(
				(r) => r.characterId === characterId && r.label.toLowerCase() === token
			);
			return r
				? { characterId, ...(from ? { seatId: from } : {}), reminderId: r.reminderId }
				: undefined;
		}
	}
}

/**
 * Every ability that would stop `seatId` dying to a kill `by` the Demon or another ability,
 * in this order: its own (`protects.who: self`, the Sailor, the Soldier), then each reminder
 * on the seat whose character's rules say it protects the player it marks (the Tea Lady's
 * "Cannot Die", the Innkeeper's and Monk's "Safe", the Devil's Advocate's "Survives
 * Execution"). From the rules blocks (`protects`), so a custom character can protect too. An
 * execution is never stopped by a protection that lasts only the night (`night`), and a
 * player who only "might not die" (`storytellerDecides`) is never protected here: the
 * Storyteller applies that in the Execution sheet (`executionSavers`). Whether each ability
 * works is the caller's to check.
 */
export function protectors(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	by: DeathBy
): Protector[] {
	const seat = getSeat(game, seatId);
	if (!seat) return [];
	const out: Protector[] = [];
	const add = (characterId: CharacterId) => {
		const rule = rulesOf(characterId, characters)?.protects;
		if (!rule || rule.storytellerDecides || !stops(rule, by)) return;
		if (out.some((p) => p.source.characterId === characterId)) return;
		const source = protectionFor(game, seatId, characterId, rule, characters);
		if (source) out.push({ source, from: rule.from });
	};
	const id = trueCharacter(game, seatId, characters);
	if (id) add(id);
	for (const r of seat.reminders) add(r.characterId);
	for (const other of game.seating) {
		const characterId = trueCharacter(game, other, characters);
		if (characterId && rulesOf(characterId, characters)?.protects?.who === 'good') add(characterId);
	}
	return out;
}

/** One ability the Storyteller may say saves an executed player, and why it might not. */
export interface ExecutionSaver {
	source: AbilitySource;
	/**
	 * Why it may not save this player: its character is not in play, its rule does not cover
	 * them (the Pacifist's good players, the Devil's Advocate's marked one), or it is drunk,
	 * poisoned or spent. The Storyteller may apply it anyway (warn, never lock).
	 */
	problem?: 'not-in-play' | 'not-this-player' | 'impaired';
}

/**
 * Every character on the script or in play whose ability can stop an execution death
 * (`protects` from `any` or `execution`, not lasting only the night), for the Execution
 * sheet's Saved by (Trevor, 2026-10-24: "a modifier slot to the execution area"). Those that
 * apply to `seatId` and work come first. Includes the ones the Storyteller decides
 * (`storytellerDecides`: the Pacifist, the Psychopath's roshambo, the Lleech, the
 * Ventriloquist's mad nominee). https://wiki.bloodontheclocktower.com/Pacifist,
 * /Devil%27s_Advocate, /Sailor, /Tea_Lady, /Vizier, /Psychopath, /Lleech, /Ventriloquist
 */
export function executionSavers(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): ExecutionSaver[] {
	return savers(game, seatId, characters, 'execution');
}

/**
 * `executionSavers` for a Traveller's exile: every character on the script or in play whose
 * ability can stop an exile death (the Tea Lady's Cannot Die, and the Deviant, whom the
 * Storyteller keeps alive when they were funny: https://wiki.bloodontheclocktower.com/Deviant,
 * /Tea_Lady).
 */
export function exileSavers(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): ExecutionSaver[] {
	return savers(game, seatId, characters, 'exile');
}

function savers(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	by: 'execution' | 'exile'
): ExecutionSaver[] {
	const ids = new Set<CharacterId>();
	for (const entry of game.script.entries)
		ids.add(entry.kind === 'official' ? entry.id : entry.character.id);
	for (const id of game.ruleCharacters) ids.add(id);
	for (const s of game.seating) {
		const id = trueCharacter(game, s, characters);
		if (id) ids.add(id);
	}
	const out: ExecutionSaver[] = [];
	for (const characterId of ids) {
		const rule = rulesOf(characterId, characters)?.protects;
		if (!rule || !stops(rule, by)) continue;
		const from = seatOfCharacter(game, characterId, characters);
		const source = protectionFor(game, seatId, characterId, rule, characters);
		const inPlay = from !== undefined || game.ruleCharacters.includes(characterId);
		const owner = source?.seatId ?? from;
		const problem = !inPlay
			? 'not-in-play'
			: !source
				? 'not-this-player'
				: owner && !abilityState(game, owner, characters).works
					? 'impaired'
					: undefined;
		out.push({
			source: source ?? { characterId, ...(from ? { seatId: from } : {}) },
			...(problem ? { problem } : {})
		});
	}
	return out.sort((a, b) => Number(!!a.problem) - Number(!!b.problem));
}

/**
 * Why a player cannot die tonight, when the grimoire says so: the Storyteller's "can die"
 * override, else the first working ability from `protectors` (the Sailor, the Tea Lady, the
 * Innkeeper, and against the Demon only the Soldier and the Monk).
 * https://wiki.bloodontheclocktower.com/Sailor, /Tea_Lady, /Innkeeper, /Soldier, /Monk
 */
export function protection(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	by: DeathBy
): AbilitySource | 'override' | undefined {
	const seat = getSeat(game, seatId);
	if (!seat) return undefined;
	const override = seat.overrides.find((o) => o.field === 'canDie');
	if (override) return override.value ? undefined : 'override';
	const works = (s: SeatId) => abilityState(game, s, characters).works;
	return protectors(game, seatId, characters, by).find(
		(p) => !p.source.seatId || works(p.source.seatId)
	)?.source;
}

/**
 * The seat's own ability that may move a kill `by` the Demon or another ability onto another
 * player (`redirectsKill`, the Mayor against the Demon:
 * https://wiki.bloodontheclocktower.com/Mayor). Whether it works is the caller's to check.
 */
export function killRedirect(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	by: 'demon' | 'other'
): AbilitySource | undefined {
	const id = trueCharacter(game, seatId, characters);
	const rule = id ? rulesOf(id, characters)?.redirectsKill : undefined;
	if (!id || !rule || (rule.from === 'demon' && by !== 'demon')) return undefined;
	return { characterId: id, seatId };
}

/** An ability that stops its player's first death, and the token that marks it spent. */
export interface FirstDeathSaver {
	source: AbilitySource;
	spentToken: ReminderLabel;
}

/**
 * The seat's own ability that stops its first death (`survivesFirstDeath`, the Fool's), while
 * its spent token is not on the seat. Whether it works is the caller's to check.
 */
export function firstDeathSaver(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): FirstDeathSaver | undefined {
	const seat = getSeat(game, seatId);
	const id = trueCharacter(game, seatId, characters);
	const rule = id ? rulesOf(id, characters)?.survivesFirstDeath : undefined;
	if (!seat || !id || !rule) return undefined;
	const spent = rule.spentToken.toLowerCase();
	if (seat.reminders.some((r) => r.characterId === id && r.label.toLowerCase() === spent))
		return undefined;
	return { source: { characterId: id, seatId }, spentToken: rule.spentToken };
}
