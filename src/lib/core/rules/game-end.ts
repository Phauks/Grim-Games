/**
 * Game end conditions met by the grimoire and the day log (Trevor, 2026-10-18: "prompt when
 * game end condition has been met"). Everything is a recommendation: the Storyteller can
 * dismiss it or end the game anyway, and conditions that need what only the Storyteller
 * knows (a public claim or guess, the Atheist, the Fiddler) are not checked.
 *
 * - Good wins when every Demon is dead; evil wins when just 2 players live, Travellers not
 *   counted (https://wiki.bloodontheclocktower.com/Glossary, "Demon", "Evil").
 * - A Demon is a seat whose true character is one, or a player with an "Is The Demon"
 *   reminder (Lil' Monsta's babysitter, https://wiki.bloodontheclocktower.com/Lil%27_Monsta;
 *   a Scarlet Woman who took over). Alive means the `dead` flag (`isAliveForWin`), except a
 *   Zombuul's first death and a Lleech whose host lives (`aliveForEnd`).
 * - Characters that end it themselves, keep it going once the Demon is dead (`holds`), or
 *   flip every result say so in their rules block's `gameEnd` (`data/game-end-rules.ts`): the
 *   Saint, Evil Twin, Vortox, Mayor, Leviathan, Fearmonger, Summoner, Mastermind, Scarlet
 *   Woman, Imp, Fang Gu, Zombuul, Lleech and Heretic among the official ones. An end with
 *   holds is listed but doesn't prompt (`promptable`).
 *
 * Results are data only (no wording): `rule` says which rule, `seats` say who.
 * Rules checked "at dusk" (Vortox, Mayor, Leviathan's day 5) use `dayEnded` for today, and
 * every day closed by Dawn ("New day") before it.
 */
import type { EndKind, GameEndRules, HoldKind } from '#lib/core/data/game-end-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	isAliveForWin,
	isTraveller,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { DayLog, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, type AbilitySource } from './ability.ts';
import { isExecution } from './death-causes.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

/**
 * Which rule ends the game. `demon-dead` and `two-alive` are the usual ends; the rest are a
 * character's `gameEnd.ends` kind (`data/game-end-rules.ts`), named in `characterId`:
 * - `demon-dead`: every Demon is dead (`seats`: the Demons);
 * - `two-alive`: just 2 players live, not counting Travellers (`seats`: who is alive);
 * - `executed-loses`: its player died by execution, so their team loses (`seats`: them);
 * - `marked-executed`: the player with its token was executed (`seats`: them, then its player);
 * - `day-without-execution`: a day passed with no execution (`day`);
 * - `alive-at-dusk`: so many players live and nobody was executed today;
 * - `executions-of-alignment`: enough players of an alignment were executed (`seats`: them);
 * - `survives-day`: its player lived past the day (`day`);
 * - `nominated-marked-executed`: its player nominated and executed the player with its token
 *   (`seats`: them, then its player);
 * - `dead-without-demon`: there is no Demon and its players are dead;
 * - `extra-day`: on the extra day, a player was executed (their team loses) or nobody was
 *   (good wins);
 * - `demon-executed`: a special rule says good wins when a Demon dies by execution (Binary
 *   Supernovae), and one has (`seats`: the executed Demons; `ruleName`: the rule).
 */
export type GameEndRule = 'demon-dead' | 'two-alive' | 'demon-executed' | EndKind;

/**
 * Why the game may go on: a character's `gameEnd.holds` kind, `extra-day` (the Demon died by
 * execution, so play one more day), or `impaired` (the character whose rule it is is drunk,
 * poisoned or has no ability, so it may not apply: the Storyteller's call). `seats`:
 * - `marked-alive`: its player, then the living player with its token;
 * - `becomes-demon`: its player;
 * - `death-passes`: the living players who may become the Demon.
 */
export type GameHoldRule = HoldKind | 'extra-day' | 'impaired';

export interface GameHold {
	rule: GameHoldRule;
	characterId: CharacterId;
	seats: SeatId[];
	wiki: string;
}

export interface GameEnd {
	/** Stable while the same condition holds, so a dismissed prompt stays dismissed. */
	key: string;
	rule: GameEndRule;
	/** The team the rule says wins, after an inverted winner (the Heretic). */
	winner: Alignment;
	/** The character whose rule it is. */
	characterId?: CharacterId;
	seats: SeatId[];
	/** The day it happened, for the rules checked at dusk (0 is before the first Dawn). */
	day?: number;
	wiki: string;
	/** Set when an ability in play turned the result round (the Heretic). */
	flippedBy?: AbilitySource;
	/** What may keep the game going; empty when nothing does. */
	holds: GameHold[];
	/** The special rule whose end it is, by name, for an end no character gives. */
	ruleName?: string;
}

export interface GameEndOptions {
	/** Today is over: Dusk has been ticked for tonight's night order. */
	dayEnded?: boolean;
	/**
	 * The name of a special rule under which good wins as soon as a Demon dies by execution
	 * (Binary Supernovae, https://beardytas.com/garden-of-djinn/binary-supernovae/).
	 */
	demonExecutedBy?: string;
}

const other = (team: Alignment): Alignment => (team === 'good' ? 'evil' : 'good');

/** The team that wins when this player's team loses. */
function losesFor(game: Game, seatId: SeatId): Alignment {
	return other(alignmentOf(game, seatId) ?? 'good');
}

/** Every day log, oldest first: index 0 is before the first Dawn, then day 1, day 2... */
function days(game: Game): DayLog[] {
	return [...game.pastDays, game.today];
}

function executedOn(log: DayLog): SeatId[] {
	return log.entries.flatMap((e) => (e.kind === 'execution' ? [e.seatId] : []));
}

function gameEndRules(characterId: CharacterId | undefined, characters: CharacterLookup) {
	return characterId ? rulesOf(characterId, characters)?.gameEnd : undefined;
}

/** A player whose true character has a rule, with the rule. */
interface Ruled<T> {
	seatId: SeatId;
	characterId: CharacterId;
	rule: T;
}

/** Every player whose true character's `gameEnd` has a rule `pick` finds, in seating order. */
function ruled<T>(
	game: Game,
	characters: CharacterLookup,
	pick: (rules: GameEndRules) => readonly T[] | undefined
): Ruled<T>[] {
	return game.seating.flatMap((seatId) => {
		const characterId = trueCharacter(game, seatId, characters);
		const rules = gameEndRules(characterId, characters);
		return characterId && rules
			? (pick(rules) ?? []).map((rule) => ({ seatId, characterId, rule }))
			: [];
	});
}

function endsOf<K extends EndKind>(game: Game, characters: CharacterLookup, kind: K) {
	return ruled(game, characters, (r) => r.ends?.filter((e) => e.kind === kind));
}

function holdsOf<K extends HoldKind>(game: Game, characters: CharacterLookup, kind: K) {
	return ruled(game, characters, (r) => r.holds?.filter((h) => h.kind === kind));
}

/** The character's wiki page, or the Glossary for a homebrew character. */
function wikiOf(characterId: CharacterId, characters: CharacterLookup): string {
	const character = characters.get(characterId);
	return (character && wikiUrl(character)) ?? `${W}Glossary`;
}

/** The players carrying a character's reminder. */
function carrying(game: Game, characterId: CharacterId, label: string): SeatId[] {
	return game.seating.filter((id) =>
		game.seats[id].reminders.some((r) => r.characterId === characterId && r.label === label)
	);
}

/** Abilities stop working when drunk or poisoned; `holds` says so rather than deciding. */
function impaired(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): GameHold[] {
	return abilityState(game, seatId, characters).impairments.length > 0
		? [{ rule: 'impaired', characterId, seats: [seatId], wiki: `${W}Glossary` }]
		: [];
}

/**
 * Alive for the game's end. Marked dead isn't always dead, while sober (`aliveWhileDead`):
 * - until its own token marks the real death: the Zombuul's first death, when it lives but
 *   registers as dead (https://wiki.bloodontheclocktower.com/Zombuul);
 * - while the player with its token lives: the Lleech dies only with its host
 *   (https://wiki.bloodontheclocktower.com/Lleech).
 */
function aliveForEnd(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	if (isAliveForWin(game, seatId)) return true;
	const seat = game.seats[seatId];
	if (!seat) return false;
	const characterId = trueCharacter(game, seatId, characters);
	const rule = gameEndRules(characterId, characters)?.aliveWhileDead;
	if (!characterId || !rule) return false;
	if (abilityState(game, seatId, characters).impairments.length > 0) return false;
	if (
		rule.untilToken &&
		seat.reminders.some((r) => r.characterId === characterId && r.label === rule.untilToken)
	) {
		return false;
	}
	if (
		rule.whileCarrierAlive &&
		!carrying(game, characterId, rule.whileCarrierAlive).some((id) => isAliveForWin(game, id))
	) {
		return false;
	}
	return true;
}

/** The Demons: by true character, or an "Is The Demon" reminder. */
export function demonSeats(game: Game, characters: CharacterLookup): SeatId[] {
	return game.seating.filter(
		(id) =>
			typeOf(game, id, characters) === 'demon' ||
			game.seats[id].reminders.some((r) => r.label === 'Is The Demon')
	);
}

/** Players alive for the "just 2 alive" rule: Travellers don't count. */
function aliveNonTravellers(game: Game, characters: CharacterLookup): SeatId[] {
	return game.seating.filter(
		(id) => aliveForEnd(game, id, characters) && !isTraveller(game, id, characters)
	);
}

/**
 * Days that are over, by index: every day closed by Dawn, and today when `dayEnded`.
 * Index 0 (before the first Dawn) is not a day.
 */
function endedDays(game: Game, options: GameEndOptions): number[] {
	const last = game.pastDays.length;
	const out: number[] = [];
	for (let day = 1; day < last; day++) out.push(day);
	if (options.dayEnded && last >= 1) out.push(last);
	return out;
}

/**
 * Whether a Demon's once-only pass happened before this death. The Storyteller marks the
 * Fang Gu's jump with its "Once" on the Fang Gu as it dies (rules `reminderTargets`), so
 * its token on the dying player is this jump, not an earlier one. It was spent before when
 * the token is on anyone else, or another player has already been this Demon (the one it
 * jumped from). https://wiki.bloodontheclocktower.com/Fang_Gu
 */
function spentBefore(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	token: string,
	characters: CharacterLookup
): boolean {
	const marked = carrying(game, characterId, token);
	if (marked.length === 0) return false;
	if (marked.some((id) => id !== seatId)) return true;
	return game.seating.some(
		(id) => id !== seatId && trueCharacter(game, id, characters) === characterId
	);
}

function demonDead(game: Game, characters: CharacterLookup): GameEnd[] {
	const demons = demonSeats(game, characters);
	if (demons.length === 0 || demons.some((id) => aliveForEnd(game, id, characters))) return [];
	const holds: GameHold[] = [];

	// Good can't win while its player and the player with its token both live (the Evil
	// Twin: https://wiki.bloodontheclocktower.com/Evil_Twin).
	for (const { seatId, characterId, rule } of holdsOf(game, characters, 'marked-alive')) {
		if (!aliveForEnd(game, seatId, characters)) continue;
		const pair = carrying(game, characterId, rule.token!).filter((id) =>
			aliveForEnd(game, id, characters)
		);
		if (pair.length === 0) continue;
		holds.push({
			rule: 'marked-alive',
			characterId,
			seats: [seatId, ...pair],
			wiki: wikiOf(characterId, characters)
		});
		holds.push(...impaired(game, seatId, characterId, characters));
	}

	// Its player may become the Demon while enough live (the Scarlet Woman: 5 or more just
	// before the Demon died, so 4 or more now; https://wiki.bloodontheclocktower.com/Scarlet_Woman).
	for (const { seatId, characterId, rule } of holdsOf(game, characters, 'becomes-demon')) {
		if (!aliveForEnd(game, seatId, characters)) continue;
		if (aliveNonTravellers(game, characters).length < rule.aliveAtLeast!) continue;
		holds.push({
			rule: 'becomes-demon',
			characterId,
			seats: [seatId],
			wiki: wikiOf(characterId, characters)
		});
		holds.push(...impaired(game, seatId, characterId, characters));
	}

	// A Demon that died by its own kill passes on to a living player of a type (the Imp to a
	// Minion, https://wiki.bloodontheclocktower.com/Imp; the Fang Gu to an Outsider, once,
	// https://wiki.bloodontheclocktower.com/Fang_Gu, its "Once" reminder saying it happened).
	for (const { seatId, characterId, rule } of holdsOf(game, characters, 'death-passes')) {
		if (!demons.includes(seatId)) continue;
		const cause = game.seats[seatId].deathCause;
		if (cause !== 'demon' && cause !== characterId) continue;
		if (rule.spentToken && spentBefore(game, seatId, characterId, rule.spentToken, characters))
			continue;
		const heirs = game.seating.filter(
			(id) => aliveForEnd(game, id, characters) && typeOf(game, id, characters) === rule.to
		);
		if (heirs.length === 0) continue;
		holds.push({
			rule: 'death-passes',
			characterId,
			seats: heirs,
			wiki: wikiOf(characterId, characters)
		});
	}

	return [
		{
			key: `demon-dead:${demons.join(',')}`,
			rule: 'demon-dead',
			winner: 'good',
			seats: demons,
			wiki: `${W}Glossary`,
			holds
		}
	];
}

/**
 * The extra day (the Mastermind, https://wiki.bloodontheclocktower.com/Mastermind): if the
 * Demon's execution would end the game, play one more day; then a player executed loses for
 * their team, and nobody executed means good wins. Returns the end that replaces
 * `demon-dead`, or a hold to add to it, or nothing when no such character is in play.
 */
function extraDay(
	game: Game,
	characters: CharacterLookup,
	options: GameEndOptions,
	end: GameEnd
): GameEnd | GameHold | undefined {
	const minds = endsOf(game, characters, 'extra-day');
	if (minds.length === 0) return undefined;
	const logs = days(game);
	const demonDay = logs.findIndex((log) => executedOn(log).some((id) => end.seats.includes(id)));
	const byExecution =
		demonDay !== -1 || end.seats.some((id) => isExecution(game.seats[id].deathCause, characters));
	if (!byExecution) return undefined;
	const extra = demonDay === -1 ? undefined : demonDay + 1;
	const executed = extra === undefined ? [] : executedOn(logs[extra] ?? { entries: [] });
	// Its player must be alive for the extra day; executed on it still counts.
	const mind = minds.find(
		({ seatId }) => aliveForEnd(game, seatId, characters) || executed.includes(seatId)
	);
	if (mind === undefined) return undefined;
	const { characterId } = mind;
	const wiki = wikiOf(characterId, characters);
	const hold: GameHold = { rule: 'extra-day', characterId, seats: [mind.seatId], wiki };
	if (extra === undefined) return hold;
	const base = {
		rule: 'extra-day' as const,
		characterId,
		day: extra,
		wiki,
		holds: impaired(game, mind.seatId, characterId, characters)
	};
	if (executed.length > 0) {
		const seatId = executed[0];
		return { ...base, key: `extra-day:${seatId}`, winner: losesFor(game, seatId), seats: [seatId] };
	}
	if (endedDays(game, options).includes(extra)) {
		return { ...base, key: `extra-day:none:${extra}`, winner: 'good', seats: [] };
	}
	return hold;
}

function twoAlive(game: Game, characters: CharacterLookup): GameEnd[] {
	const alive = aliveNonTravellers(game, characters);
	if (alive.length > 2) return [];
	return [
		{
			key: 'two-alive',
			rule: 'two-alive',
			winner: 'evil',
			seats: alive,
			wiki: `${W}Glossary`,
			holds: []
		}
	];
}

/** Its player died by execution, so their team loses (the Saint). */
function executedLoses(game: Game, characters: CharacterLookup): GameEnd[] {
	return endsOf(game, characters, 'executed-loses')
		.filter(
			({ seatId }) =>
				game.seats[seatId].dead && isExecution(game.seats[seatId].deathCause, characters)
		)
		.map(({ seatId, characterId }) => ({
			key: `executed-loses:${seatId}`,
			rule: 'executed-loses',
			winner: losesFor(game, seatId),
			characterId,
			seats: [seatId],
			wiki: wikiOf(characterId, characters),
			holds: impaired(game, seatId, characterId, characters)
		}));
}

/** The player with its token was executed while its player lives (the Evil Twin's twin). */
function markedExecuted(game: Game, characters: CharacterLookup): GameEnd[] {
	const out: GameEnd[] = [];
	for (const { seatId, characterId, rule } of endsOf(game, characters, 'marked-executed')) {
		// A dead player has no ability (https://wiki.bloodontheclocktower.com/Evil_Twin).
		if (!aliveForEnd(game, seatId, characters)) continue;
		for (const marked of carrying(game, characterId, rule.token!)) {
			const seat = game.seats[marked];
			if (!seat.dead || !isExecution(seat.deathCause, characters)) continue;
			out.push({
				key: `marked-executed:${marked}`,
				rule: 'marked-executed',
				winner: rule.winner!,
				characterId,
				seats: [marked, seatId],
				wiki: wikiOf(characterId, characters),
				holds: impaired(game, seatId, characterId, characters)
			});
		}
	}
	return out;
}

/** While its player lives, a day ended with no execution (the Vortox; exile doesn't count). */
function dayWithoutExecution(
	game: Game,
	characters: CharacterLookup,
	options: GameEndOptions
): GameEnd[] {
	const found = endsOf(game, characters, 'day-without-execution').find(({ seatId }) =>
		aliveForEnd(game, seatId, characters)
	);
	if (found === undefined) return [];
	const logs = days(game);
	const day = endedDays(game, options).find((d) => executedOn(logs[d]).length === 0);
	if (day === undefined) return [];
	const { seatId, characterId, rule } = found;
	return [
		{
			key: `day-without-execution:${day}`,
			rule: 'day-without-execution',
			winner: rule.winner!,
			characterId,
			seats: [seatId],
			day,
			wiki: wikiOf(characterId, characters),
			holds: impaired(game, seatId, characterId, characters)
		}
	];
}

/**
 * At dusk with exactly so many alive (Travellers count) and no execution today, its living
 * player's team wins (the Mayor with 3; a drunk Mayor is the Drunk, so it doesn't apply:
 * https://wiki.bloodontheclocktower.com/Mayor).
 */
function aliveAtDusk(game: Game, characters: CharacterLookup, options: GameEndOptions): GameEnd[] {
	if (!options.dayEnded || game.pastDays.length < 1) return [];
	if (executedOn(game.today).length > 0) return [];
	const alive = game.seating.filter((id) => aliveForEnd(game, id, characters));
	return endsOf(game, characters, 'alive-at-dusk')
		.filter(({ seatId, rule }) => alive.length === rule.alive && alive.includes(seatId))
		.map(({ seatId, characterId }) => ({
			key: `alive-at-dusk:${game.pastDays.length}`,
			rule: 'alive-at-dusk',
			winner: alignmentOf(game, seatId) ?? 'good',
			characterId,
			seats: [seatId],
			day: game.pastDays.length,
			wiki: wikiOf(characterId, characters),
			holds: impaired(game, seatId, characterId, characters)
		}));
}

/**
 * While its player lives: enough players of an alignment executed, or the player alive at the
 * end of a day, wins (the Leviathan's second good execution and day 5,
 * https://wiki.bloodontheclocktower.com/Leviathan). The alignment is the one the rules use now.
 */
function whileAlive(game: Game, characters: CharacterLookup, options: GameEndOptions): GameEnd[] {
	const out: GameEnd[] = [];
	for (const { seatId, characterId, rule } of endsOf(game, characters, 'executions-of-alignment')) {
		if (!aliveForEnd(game, seatId, characters)) continue;
		const executed = days(game)
			.flatMap(executedOn)
			.filter((id) => alignmentOf(game, id) === rule.alignment)
			.slice(0, rule.count);
		if (executed.length < rule.count!) continue;
		out.push({
			key: `executions-of-alignment:${executed.join(',')}`,
			rule: 'executions-of-alignment',
			winner: rule.winner!,
			characterId,
			seats: executed,
			wiki: wikiOf(characterId, characters),
			holds: impaired(game, seatId, characterId, characters)
		});
	}
	for (const { seatId, characterId, rule } of endsOf(game, characters, 'survives-day')) {
		if (!aliveForEnd(game, seatId, characters)) continue;
		if (!endedDays(game, options).includes(rule.day!)) continue;
		out.push({
			key: `survives-day:${rule.day}`,
			rule: 'survives-day',
			winner: rule.winner!,
			characterId,
			seats: [seatId],
			day: rule.day,
			wiki: wikiOf(characterId, characters),
			holds: impaired(game, seatId, characterId, characters)
		});
	}
	return out;
}

/**
 * Its player nominated and executed the player with its token, whose team loses (the
 * Fearmonger's "Fear": https://wiki.bloodontheclocktower.com/Fearmonger).
 */
function nominatedMarkedExecuted(game: Game, characters: CharacterLookup): GameEnd[] {
	const out: GameEnd[] = [];
	for (const { seatId, characterId, rule } of endsOf(
		game,
		characters,
		'nominated-marked-executed'
	)) {
		const marked = carrying(game, characterId, rule.token!);
		for (const log of days(game)) {
			const executed = executedOn(log);
			for (const entry of log.entries) {
				if (entry.kind !== 'nomination' || entry.nominator !== seatId) continue;
				const target = entry.nominee;
				if (!marked.includes(target) || !executed.includes(target)) continue;
				out.push({
					key: `nominated-marked-executed:${target}`,
					rule: 'nominated-marked-executed',
					winner: losesFor(game, target),
					characterId,
					seats: [target, seatId],
					wiki: wikiOf(characterId, characters),
					holds: impaired(game, seatId, characterId, characters)
				});
			}
		}
	}
	return out;
}

/**
 * There is no Demon and its players are dead (the Summoner, who can no longer summon one:
 * https://wiki.bloodontheclocktower.com/Summoner).
 */
function deadWithoutDemon(game: Game, characters: CharacterLookup): GameEnd[] {
	if (demonSeats(game, characters).length > 0) return [];
	const found = endsOf(game, characters, 'dead-without-demon');
	if (found.length === 0 || found.some(({ seatId }) => aliveForEnd(game, seatId, characters)))
		return [];
	const seats = found.map((f) => f.seatId);
	const { characterId, rule } = found[0];
	return [
		{
			key: `dead-without-demon:${seats.join(',')}`,
			rule: 'dead-without-demon',
			winner: rule.winner!,
			characterId,
			seats,
			wiki: wikiOf(characterId, characters),
			holds: []
		}
	];
}

/**
 * Whoever wins, loses (`invertWinner`), even if its player is dead; not while drunk or
 * poisoned (the Heretic: https://wiki.bloodontheclocktower.com/Heretic).
 */
function inverter(game: Game, characters: CharacterLookup): AbilitySource | undefined {
	const found = ruled(game, characters, (r) => (r.invertWinner ? [true] : [])).find(
		({ seatId }) => abilityState(game, seatId, characters).impairments.length === 0
	);
	return found && { characterId: found.characterId, seatId: found.seatId };
}

/** A Demon died by execution, under a rule that makes that a win for good. */
function demonExecuted(game: Game, characters: CharacterLookup, ruleName: string): GameEnd[] {
	// Dead by execution, as for the Saint.
	const seats = demonSeats(game, characters).filter(
		(id) => game.seats[id].dead && isExecution(game.seats[id].deathCause, characters)
	);
	if (seats.length === 0) return [];
	// The rule's page lets an ability such as the Mastermind's keep the game going.
	const holds: GameHold[] = endsOf(game, characters, 'extra-day')
		.filter(({ seatId }) => aliveForEnd(game, seatId, characters))
		.flatMap(({ seatId, characterId }) => [
			{
				rule: 'extra-day' as const,
				characterId,
				seats: [seatId],
				wiki: wikiOf(characterId, characters)
			},
			...impaired(game, seatId, characterId, characters)
		]);
	return [
		{
			key: `demon-executed:${seats.join(',')}`,
			rule: 'demon-executed',
			winner: 'good',
			seats,
			wiki: `${W}Glossary`,
			holds,
			ruleName
		}
	];
}

/**
 * Every game end condition met now, most decisive first. Empty until a seat has a
 * character. A met `demon-dead` with `holds` is listed so the Storyteller sees why the game
 * may go on.
 */
export function gameEnds(
	game: Game,
	characters: CharacterLookup,
	options: GameEndOptions = {}
): GameEnd[] {
	if (game.seating.every((id) => game.seats[id].characterId === undefined)) return [];

	const out: GameEnd[] = options.demonExecutedBy
		? demonExecuted(game, characters, options.demonExecutedBy)
		: [];
	const demon = demonDead(game, characters);
	for (const end of demon) {
		const mind = extraDay(game, characters, options, end);
		if (mind === undefined) out.push(end);
		else if ('key' in mind) out.push(mind);
		else out.push({ ...end, holds: [...end.holds, mind] });
	}
	out.push(
		...executedLoses(game, characters),
		...markedExecuted(game, characters),
		...nominatedMarkedExecuted(game, characters),
		...whileAlive(game, characters, options),
		...dayWithoutExecution(game, characters, options),
		...aliveAtDusk(game, characters, options),
		...deadWithoutDemon(game, characters)
	);
	// A dead Demon wins it for good before "just 2 alive" can.
	if (demon.length === 0) out.push(...twoAlive(game, characters));

	const flip = inverter(game, characters);
	if (!flip) return out;
	return out.map((end) => ({ ...end, winner: other(end.winner), flippedBy: flip }));
}

/**
 * The winner the prompt can preselect: the one every end agrees on, with nothing that may
 * keep the game going. Undefined when they disagree or something holds, so the Storyteller
 * picks (Trevor, 2026-10-18: list every valid outcome, never one pick).
 */
/** The ends that open the prompt: nothing may keep the game going (Trevor, 2026-10-18). */
export function promptable(ends: readonly GameEnd[]): GameEnd[] {
	return ends.filter((e) => e.holds.length === 0);
}

export function suggestedWinner(ends: readonly GameEnd[]): Alignment | undefined {
	if (ends.length === 0 || ends.some((e) => e.holds.length > 0)) return undefined;
	const winners = new Set(ends.map((e) => e.winner));
	return winners.size === 1 ? ends[0].winner : undefined;
}

/**
 * The Demon killed itself with a Minion alive (the Imp:
 * https://wiki.bloodontheclocktower.com/Imp): the living Minions who may become the Demon, and
 * the player whose ability makes it theirs (the Scarlet Woman:
 * https://wiki.bloodontheclocktower.com/Scarlet_Woman). Undefined once a Demon lives.
 */
export function starPass(
	game: Game,
	characters: CharacterLookup
): { minions: SeatId[]; preferred?: SeatId } | undefined {
	const holds = demonDead(game, characters).flatMap((end) => end.holds);
	const pass = holds.find(
		(h) =>
			h.rule === 'death-passes' &&
			gameEndRules(h.characterId, characters)?.holds?.some(
				(r) => r.kind === 'death-passes' && r.to === 'minion'
			)
	);
	if (!pass) return undefined;
	const heir = holds.find((h) => h.rule === 'becomes-demon')?.seats[0];
	return { minions: pass.seats, preferred: heir && pass.seats.includes(heir) ? heir : undefined };
}
