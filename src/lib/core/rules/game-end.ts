/**
 * Game end conditions met by the grimoire and the day log (Trevor, 2026-10-18: "prompt when
 * game end condition has been met"). Everything is a recommendation: the Storyteller can
 * dismiss it or end the game anyway, and conditions that need what only the Storyteller
 * knows (the Atheist, the Fiddler, the Politician) are not checked.
 *
 * - Good wins when every Demon is dead; evil wins when just 2 players live, Travellers not
 *   counted (https://wiki.bloodontheclocktower.com/Glossary, "Demon", "Evil").
 * - A Demon is a seat whose true character is one, or a player with a reminder that makes them
 *   the Demon (`carriesDemonToken`: Lil' Monsta's babysitter,
 *   https://wiki.bloodontheclocktower.com/Lil%27_Monsta; a Scarlet Woman who took over). Alive means the `dead` flag (`isAliveForWin`), except a
 *   Zombuul's first death and a Lleech whose host lives (`aliveForEnd`).
 * - Characters that end it themselves, keep it going once the Demon is dead (`holds`), or
 *   flip every result say so in their rules block's `gameEnd` (`data/parts/game-end.ts`): the
 *   Saint, Evil Twin, Vortox, Mayor, Leviathan, Fearmonger, Summoner, Mastermind, Klutz,
 *   Damsel, Goblin, Legion, Alsaahir, Scarlet Woman, Imp, Fang Gu, Zombuul, Lleech and Heretic
 *   among the official ones. An end with
 *   holds is listed but doesn't prompt (`promptable`).
 *
 * - A jinx may add an end with its partner (`jinxes.endsGame`, `data/jinx-rules.ts`): the
 *   Leviathan's and Riot's (`jinxEnds`). Such an end names the partner in `jinxedWith`.
 *
 * Results are data only (no wording): `rule` says which rule, `seats` say who.
 * Rules checked "at dusk" (Vortox, Mayor, Leviathan's day 5) use `dayEnded` for today, and
 * every day closed by Dawn ("New day") before it.
 */
import type { EndKind } from '#lib/core/data/parts/game-end.ts';
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, inPlay, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, type AbilitySource } from './ability.ts';
import { isExecution } from './death-causes.ts';
import { jinxEnds } from './jinx-ends.ts';
import { conditionEnds } from './game-end-conditions.ts';
import { deadWithoutDemon } from './dead-without-demon.ts';
import { jinxEffect } from './jinxes.ts';
import { rebirthOf } from './reincarnation.ts';
import {
	W,
	aliveForEnd,
	aliveNonTravellers,
	carrying,
	days,
	demonSeats,
	guessesEvilTeam,
	endedDays,
	endName,
	eventsOf,
	executedOn,
	holdsOf,
	impaired,
	isOn,
	losesFor,
	other,
	ruled,
	wikiOf,
	winnerFor
} from './game-end-helpers.ts';
import { storytellerExecuted } from './storyteller-end.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

export { livesWhileDead } from './game-end-helpers.ts';

/**
 * Which rule ends the game. `demon-dead` and `two-alive` are the usual ends; the rest are a
 * character's `gameEnd.ends` kind (`data/parts/game-end.ts`), named in `characterId`:
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
 * - `used-on-loses`: its ability's first logged use named a player of the kind it says, so
 *   that ability's player's team loses (`seats`: the player named, then its player);
 * - `executed-with-token`: its player was executed carrying its own token (`seats`: them);
 * - `alignment-alive`: few enough players of an alignment are left (`seats`: those left);
 * - `guesses-evil-team`: its player's guesses named the whole evil team (`seats`: its player,
 *   then the Demons and Minions);
 * - `cult-joined`: its player's vote passed today (`seats`: them);
 * - `storyteller-executed`: the Storyteller was executed: `winner` from a character in play
 *   (`seats`: its players, dead or alive), otherwise evil with no `characterId`;
 * - `demon-executed`: a special rule says good wins when a Demon dies by execution (Binary
 *   Supernovae), and one has (`seats`: the executed Demons; `ruleName`: the rule);
 * - `partner-stops`: a jinx's partner stopped its ability (`jinxEnds`, the Mayor stopping
 *   the riot; `seats`: the partner's player, then the living players of its character);
 * - `jinx-executed`: a jinx says this character's or its partner's player being executed ends
 *   the game (`jinxEnds`, a custom script's jinx, M44; `seats`: the executed player).
 */
export type GameEndRule =
	'demon-dead' | 'two-alive' | 'demon-executed' | 'partner-stops' | 'jinx-executed' | EndKind;

/**
 * Why the game may go on: a character's `gameEnd.holds` kind, `extra-day` (the Demon died by
 * execution, so play one more day), or `impaired` (the character whose rule it is is drunk,
 * poisoned or has no ability, so it may not apply: the Storyteller's call). `seats`:
 * - `marked-alive`: its player, then the living player with its token;
 * - `becomes-demon`: its player;
 * - `death-passes`: the living players who may become the Demon;
 * - `jinx-night`: a jinx makes the extra day a night (`partnerChoosesEnd`: the executed
 *   Al-Hadikhia chooses 3 good players with the Mastermind alive), so the Storyteller ends the
 *   game by that night's choice; `characterId` is the Demon's, `seats` the Mastermind's player.
 */
export type GameHoldRule =
	'marked-alive' | 'becomes-demon' | 'death-passes' | 'extra-day' | 'jinx-night' | 'impaired';

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
	/**
	 * The day it happened, for the rules checked at dusk (0 is before the first Dawn); for
	 * `dead-without-demon` while its player lives, the night that passed with no Demon made.
	 */
	day?: number;
	wiki: string;
	/** Set when an ability in play turned the result round (the Heretic). */
	flippedBy?: AbilitySource;
	/** What may keep the game going; empty when nothing does. */
	holds: GameHold[];
	/** The special rule whose end it is, by name, for an end no character gives. */
	ruleName?: string;
	/**
	 * Set when a jinx between `characterId` and this character gives the end (the Leviathan
	 * nominating and executing the Soldier), so the jinx's own text says why.
	 */
	jinxedWith?: CharacterId;
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
	// A Demon among the first to die while players are reborn (the Hindu's first four) is not
	// reborn: its death ends the game as any Demon's would, so the Scarlet Woman or a star pass
	// still keeps it going (https://wiki.bloodontheclocktower.com/Hindu; Trevor, 2026-10-31).
	const rebirth = demons.map((id) => rebirthOf(game, id, characters)).find((id) => id);
	const holds: GameHold[] = [];
	const enough = (n: number | undefined) =>
		n === undefined || aliveNonTravellers(game, characters).length >= n;

	// Good can't win while its player and the player with its token both live (the Evil
	// Twin: https://wiki.bloodontheclocktower.com/Evil_Twin).
	for (const { seatId, characterId, rule } of holdsOf(game, characters, 'blocks-good')) {
		if (rule.whileAlive && !aliveForEnd(game, seatId, characters)) continue;
		const pair = rule.token
			? carrying(game, characterId, rule.token).filter((id) => aliveForEnd(game, id, characters))
			: [];
		if (rule.token && pair.length === 0) continue;
		if (!enough(rule.aliveAtLeast)) continue;
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
		if (rule.whileAlive && !aliveForEnd(game, seatId, characters)) continue;
		if (
			rule.token &&
			!carrying(game, characterId, rule.token).some((id) => aliveForEnd(game, id, characters))
		)
			continue;
		if (!enough(rule.aliveAtLeast)) continue;
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
	for (const { seatId, characterId, rule } of holdsOf(game, characters, 'demon-passes')) {
		if (!demons.includes(seatId)) continue;
		const cause = game.seats[seatId].deathCause;
		if (rule.ownKill && cause !== 'demon' && cause !== characterId) continue;
		if (rule.spentToken && spentBefore(game, seatId, characterId, rule.spentToken, characters))
			continue;
		if (!enough(rule.aliveAtLeast)) continue;
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

	// A Demon passing on by its own death makes no second Demon of a player whose jinx with it
	// says so (`notSecondDemon`: when the Fang Gu jumps, the Scarlet Woman remains the Scarlet
	// Woman, https://wiki.bloodontheclocktower.com/Scarlet_Woman#Related_Jinxes).
	const passes = holds.filter((h) => h.rule === 'death-passes').map((h) => h.characterId);
	const kept = holds.filter(
		(h) =>
			(h.rule !== 'becomes-demon' && h.rule !== 'impaired') ||
			!passes.some((p) => jinxEffect(game, h.characterId, p, 'notSecondDemon', characters))
	);
	return [
		{
			key: `demon-dead:${demons.join(',')}`,
			rule: 'demon-dead',
			winner: 'good',
			...(rebirth ? { characterId: rebirth } : {}),
			seats: demons,
			wiki: rebirth ? wikiOf(rebirth, characters) : `${W}Glossary`,
			holds: kept
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
	const minds = eventsOf(game, characters, 'demon-executed').filter(
		({ rule }) => rule.then === 'extra-day'
	);
	if (minds.length === 0) return undefined;
	const logs = days(game);
	// The execution that ended it is the last: a Zombuul's first, survived one didn't
	// (https://wiki.bloodontheclocktower.com/Mastermind).
	const demonDay = logs.findLastIndex((log) =>
		executedOn(log).some((id) => end.seats.includes(id))
	);
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
	// A jinx makes the extra day a night whose choice ends the game (`night-instead`, its
	// `chooser` the partner's player or this one's: the Al-Hadikhia,
	// https://wiki.bloodontheclocktower.com/Mastermind#Related_Jinxes).
	for (const id of end.seats.map((s) => trueCharacter(game, s, characters))) {
		if (id === undefined) continue;
		const night = jinxEffect(game, characterId, id, 'endsGame', characters);
		if (night?.kind !== 'night-instead') continue;
		const chooser = night.chooser === 'self' ? characterId : id;
		return { rule: 'jinx-night', characterId: chooser, seats: [mind.seatId], wiki };
	}
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

/**
 * Of its player and the player with its token, one of `alignment` was executed while, with
 * `otherAlive`, the other lives (`subject: 'either'`). The Evil Twin: the good twin is
 * whichever twin is good, even a good-aligned Evil Twin
 * (https://wiki.bloodontheclocktower.com/Evil_Twin).
 */
function markedExecuted(game: Game, characters: CharacterLookup): GameEnd[] {
	const out: GameEnd[] = [];
	for (const { seatId, characterId, rule } of eventsOf(game, characters, 'executed')) {
		if (rule.subject !== 'either') continue;
		for (const marked of carrying(game, characterId, rule.token!)) {
			const pair = [marked, seatId];
			const executed = pair.find(
				(id) =>
					game.seats[id].dead &&
					isExecution(game.seats[id].deathCause, characters) &&
					(!rule.alignment || alignmentOf(game, id) === rule.alignment)
			);
			if (executed === undefined) continue;
			// A dead player has no ability: the other twin must be alive.
			const twin = executed === marked ? seatId : marked;
			if (rule.otherAlive && !aliveForEnd(game, twin, characters)) continue;
			out.push({
				key: `${endName(rule)}:${executed}`,
				rule: endName(rule),
				winner: winnerFor(game, seatId, rule, executed),
				characterId,
				seats: [executed, twin],
				wiki: wikiOf(characterId, characters),
				holds: impaired(game, seatId, characterId, characters)
			});
		}
	}
	return out;
}

/**
 * Its player's vote passed today, so their team wins (the Cult Leader: every living good player
 * joined the cult, https://wiki.bloodontheclocktower.com/Cult_Leader). The vote is recorded
 * when its use is marked (`UseAbility`'s `passed`). A poisoned or drunk player's cult doesn't
 * form, so that holds it (the Storyteller's call).
 */
function cultJoined(game: Game, characters: CharacterLookup): GameEnd[] {
	return eventsOf(game, characters, 'vote-passed').flatMap(({ seatId, characterId, rule }) => {
		const passed = game.today.entries.some(
			(e) =>
				e.kind === 'ability' &&
				e.seatId === seatId &&
				e.characterId === characterId &&
				e.passed === true
		);
		if (!passed) return [];
		return [
			{
				key: `${endName(rule)}:${seatId}:${game.pastDays.length}`,
				rule: endName(rule),
				winner: winnerFor(game, seatId, rule),
				characterId,
				seats: [seatId],
				day: game.pastDays.length,
				wiki: wikiOf(characterId, characters),
				holds: impaired(game, seatId, characterId, characters)
			}
		];
	});
}

/**
 * An ability's first logged use names a player who is `on`, so the team of the player who
 * used it loses (`used-on-loses`): the Klutz choosing an evil player
 * (https://wiki.bloodontheclocktower.com/Klutz), held as a gained ability too (the Hermit); a
 * Minion guessing the Damsel (https://wiki.bloodontheclocktower.com/Damsel). When its rules
 * mark the ability spent with a token of its own, only the use that placed it counts: one
 * placed before (a wrong guess) spends it.
 */
function usedOnLoses(game: Game, characters: CharacterLookup): GameEnd[] {
	const out: GameEnd[] = [];
	const counted = new Set<string>();
	for (const log of days(game)) {
		for (const entry of log.entries) {
			if (entry.kind !== 'ability' || entry.on === undefined) continue;
			const { seatId, characterId, on } = entry;
			const rules = rulesFor(game, characterId, characters);
			const rule = rules?.gameEnd?.ends?.find(
				(e) => e.kind === 'condition' && e.event === 'ability-used'
			);
			if (!rule || !game.seats[seatId] || !game.seats[on]) continue;
			const use = `${seatId}:${characterId}`;
			if (counted.has(use)) continue;
			counted.add(use);
			const spent = rules?.dayUse?.spentToken ?? 'No Ability';
			const spends = characters.get(characterId)?.reminders.includes(spent) ?? false;
			if (spends && entry.reminderId === undefined) continue;
			if (!isOn(game, on, rule.on!, characters)) continue;
			out.push({
				key: `${endName(rule)}:${entry.entryId}`,
				rule: endName(rule),
				winner: winnerFor(game, seatId, rule, on),
				characterId,
				seats: [on, seatId],
				wiki: wikiOf(characterId, characters),
				holds: impaired(game, seatId, characterId, characters)
			});
		}
	}
	return out;
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
	const holds: GameHold[] = eventsOf(game, characters, 'demon-executed')
		.filter(({ rule }) => rule.then === 'extra-day')
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
	full: Game,
	characters: CharacterLookup,
	options: GameEndOptions = {}
): GameEnd[] {
	// Seats not in play yet count for nothing (`Seat.notInPlay`).
	const game = inPlay(full);
	if (game.seating.every((id) => game.seats[id].characterId === undefined)) return [];

	const out: GameEnd[] = [
		...storytellerExecuted(days(game), eventsOf(game, characters, 'storyteller-executed'), (id) =>
			wikiOf(id, characters)
		),
		...(options.demonExecutedBy ? demonExecuted(game, characters, options.demonExecutedBy) : [])
	];
	const demon = demonDead(game, characters);
	for (const end of demon) {
		const mind = extraDay(game, characters, options, end);
		if (mind === undefined) out.push(end);
		else if ('key' in mind) out.push(mind);
		else out.push({ ...end, holds: [...end.holds, mind] });
	}
	const jinxed = jinxEnds(game, characters, {
		logs: days(game),
		ended: endedDays(game, options),
		executedOn,
		alive: (id) => aliveForEnd(game, id, characters),
		impaired: (id, characterId) => impaired(game, id, characterId, characters),
		carrying: (characterId, label) => carrying(game, characterId, label),
		wiki: (characterId) => wikiOf(characterId, characters)
	});
	const condition = (...kinds: string[]) =>
		conditionEnds(game, characters, options, (r) => kinds.includes(r.preset ?? 'condition'));
	out.push(
		...condition('executed-loses'),
		...markedExecuted(game, characters),
		...condition('nominated-marked-executed'),
		...jinxed.ends,
		// A jinx end on a day replaces the character's own end that day (the Leviathan's day 5
		// with the Mayor alive and no execution).
		...condition('executions-of-alignment', 'survives-day').filter(
			(e) => !jinxed.replaced.has(`${e.characterId}:${e.day}`)
		),
		...condition('day-without-execution'),
		...condition('alive-at-dusk'),
		...deadWithoutDemon(game, characters),
		...usedOnLoses(game, characters),
		...condition('executed-with-token'),
		...condition('alignment-alive'),
		...guessesEvilTeam(game, characters),
		...cultJoined(game, characters),
		...condition('condition')
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
 * The Demon died by its own kill with a player alive to take it on (the Imp's Minions,
 * https://wiki.bloodontheclocktower.com/Imp; the Fang Gu's Outsiders, once,
 * https://wiki.bloodontheclocktower.com/Fang_Gu): that Demon, the players who may become it,
 * and the player whose ability makes it theirs (the Scarlet Woman:
 * https://wiki.bloodontheclocktower.com/Scarlet_Woman), with the character whose rule
 * (`gameEnd.holds` `becomes-demon`) says so. A drunk or poisoned player's ability doesn't work
 * (https://wiki.bloodontheclocktower.com/Glossary), so they aren't preferred. Undefined once a
 * Demon lives.
 */
export function starPass(
	game: Game,
	characters: CharacterLookup
):
	| { characterId: CharacterId; heirs: SeatId[]; preferred?: SeatId; preferredBy?: CharacterId }
	| undefined {
	const holds = demonDead(game, characters).flatMap((end) => end.holds);
	const pass = holds.find((h) => h.rule === 'death-passes');
	if (!pass) return undefined;
	const rule = holds.find(
		(h) =>
			h.rule === 'becomes-demon' &&
			pass.seats.includes(h.seats[0]) &&
			!holds.some(
				(i) => i.rule === 'impaired' && i.characterId === h.characterId && i.seats[0] === h.seats[0]
			)
	);
	const heirs = rule
		? [rule.seats[0], ...pass.seats.filter((id) => id !== rule.seats[0])]
		: pass.seats;
	return {
		characterId: pass.characterId,
		heirs,
		...(rule ? { preferred: rule.seats[0], preferredBy: rule.characterId } : {})
	};
}
