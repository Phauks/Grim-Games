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
 * - Characters that end it themselves: Saint, Evil Twin, Vortox, Mayor, Leviathan,
 *   Fearmonger, Summoner, Mastermind; the Heretic flips every result.
 * - Characters that may keep it going once the Demon is dead (`holds`): Evil Twin, Scarlet
 *   Woman, Mastermind, Imp, Fang Gu. An end with holds is listed but doesn't prompt
 *   (`promptable`).
 *
 * Results are data only (no wording): `rule` says which rule, `seats` say who.
 * Rules checked "at dusk" (Vortox, Mayor, Leviathan's day 5) use `dayEnded` for today, and
 * every day closed by Dawn ("New day") before it.
 */
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
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

const W = 'https://wiki.bloodontheclocktower.com/';

/**
 * Which rule ends the game:
 * - `demon-dead`: every Demon is dead (`seats`: the Demons);
 * - `two-alive`: just 2 players live, not counting Travellers (`seats`: who is alive);
 * - `saint`: the Saint died by execution, so its team loses;
 * - `evil-twin`: the good twin was executed (`seats`: the twin, then the Evil Twin);
 * - `vortox`: a day passed with no execution (`day`);
 * - `mayor`: 3 players live and nobody was executed today;
 * - `leviathan-executions`: a second good player was executed (`seats`: those executed);
 * - `leviathan-day-5`: the Leviathan lived past day 5;
 * - `fearmonger`: the Fearmonger nominated and executed its chosen player;
 * - `summoner`: there is no Demon and the Summoner is dead, so none can be summoned;
 * - `mastermind`: on the Mastermind's extra day, a player was executed (their team loses)
 *   or nobody was (good wins).
 */
export type GameEndRule =
	| 'demon-dead'
	| 'two-alive'
	| 'saint'
	| 'evil-twin'
	| 'vortox'
	| 'mayor'
	| 'leviathan-executions'
	| 'leviathan-day-5'
	| 'fearmonger'
	| 'summoner'
	| 'mastermind';

/**
 * Why the game may go on:
 * - `evil-twin`: both twins live, so good can't win (`seats`: Evil Twin, then twin);
 * - `scarlet-woman`: 5 or more were alive when the Demon died, so she may become the Demon;
 * - `mastermind`: the Demon died by execution, so play one more day;
 * - `imp`: the Imp killed itself, so a Minion may become the Imp (`seats`: alive Minions);
 * - `fang-gu`: the Fang Gu killed an Outsider, who may become the Fang Gu (`seats`: alive
 *   Outsiders);
 * - `impaired`: the character whose rule it is is drunk, poisoned or has no ability, so it
 *   may not apply (the Storyteller's call).
 */
export type GameHoldRule =
	'evil-twin' | 'scarlet-woman' | 'mastermind' | 'imp' | 'fang-gu' | 'impaired';

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
	/** The team the rule says wins, after the Heretic. */
	winner: Alignment;
	/** The character whose rule it is. */
	characterId?: CharacterId;
	seats: SeatId[];
	/** The day it happened, for the rules checked at dusk (0 is before the first Dawn). */
	day?: number;
	wiki: string;
	/** Set when a Heretic in play turned the result round. */
	flippedBy?: AbilitySource;
	/** What may keep the game going; empty when nothing does. */
	holds: GameHold[];
}

export interface GameEndOptions {
	/** Today is over: Dusk has been ticked for tonight's night order. */
	dayEnded?: boolean;
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

function seatsOf(game: Game, characterId: CharacterId, characters: CharacterLookup): SeatId[] {
	return game.seating.filter((id) => trueCharacter(game, id, characters) === characterId);
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
 * Alive for the game's end. Marked dead isn't always dead:
 * - the Zombuul's first death: it lives but registers as dead, unless drunk or poisoned
 *   then (https://wiki.bloodontheclocktower.com/Zombuul). Its own "Dead" reminder marks
 *   that the first death has happened, so marked dead with it is dead;
 * - the Lleech dies only when its host (its "Poisoned" reminder) is dead, unless drunk or
 *   poisoned (https://wiki.bloodontheclocktower.com/Lleech).
 */
function aliveForEnd(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	if (isAliveForWin(game, seatId)) return true;
	const seat = game.seats[seatId];
	if (!seat) return false;
	const sober = abilityState(game, seatId, characters).impairments.length === 0;
	switch (trueCharacter(game, seatId, characters)) {
		case 'zombuul':
			return (
				sober && !seat.reminders.some((r) => r.characterId === 'zombuul' && r.label === 'Dead')
			);
		case 'lleech':
			return (
				sober &&
				game.seating.some(
					(id) =>
						isAliveForWin(game, id) &&
						game.seats[id].reminders.some(
							(r) => r.characterId === 'lleech' && r.label === 'Poisoned'
						)
				)
			);
		default:
			return false;
	}
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

function demonDead(game: Game, characters: CharacterLookup): GameEnd[] {
	const demons = demonSeats(game, characters);
	if (demons.length === 0 || demons.some((id) => aliveForEnd(game, id, characters))) return [];
	const holds: GameHold[] = [];

	// Evil Twin: good can't win while both twins live (https://wiki.bloodontheclocktower.com/Evil_Twin).
	for (const twin of seatsOf(game, 'eviltwin', characters)) {
		if (!aliveForEnd(game, twin, characters)) continue;
		const pair = twinOf(game);
		if (pair.length === 0 || !pair.some((id) => aliveForEnd(game, id, characters))) continue;
		holds.push({
			rule: 'evil-twin',
			characterId: 'eviltwin',
			seats: [twin, ...pair.filter((id) => aliveForEnd(game, id, characters))],
			wiki: `${W}Evil_Twin`
		});
		holds.push(...impaired(game, twin, 'eviltwin', characters));
	}

	// Scarlet Woman: 5 or more alive (not Travellers) just before the Demon died
	// (https://wiki.bloodontheclocktower.com/Scarlet_Woman). The Demon is dead now, so 4 or more.
	for (const woman of seatsOf(game, 'scarletwoman', characters)) {
		if (!aliveForEnd(game, woman, characters)) continue;
		if (aliveNonTravellers(game, characters).length < 4) continue;
		holds.push({
			rule: 'scarlet-woman',
			characterId: 'scarletwoman',
			seats: [woman],
			wiki: `${W}Scarlet_Woman`
		});
		holds.push(...impaired(game, woman, 'scarletwoman', characters));
	}

	// Imp: killing itself makes a Minion the Imp (https://wiki.bloodontheclocktower.com/Imp).
	const minions = game.seating.filter(
		(id) => aliveForEnd(game, id, characters) && typeOf(game, id, characters) === 'minion'
	);
	for (const id of demons) {
		const cause = game.seats[id].deathCause;
		if (trueCharacter(game, id, characters) !== 'imp' || minions.length === 0) continue;
		if (cause !== 'demon' && cause !== 'imp') continue;
		holds.push({ rule: 'imp', characterId: 'imp', seats: minions, wiki: `${W}Imp` });
	}

	// Fang Gu: the first Outsider it kills becomes the Fang Gu, and it dies instead
	// (https://wiki.bloodontheclocktower.com/Fang_Gu). Its "Once" reminder says that happened.
	const outsiders = game.seating.filter(
		(id) => aliveForEnd(game, id, characters) && typeOf(game, id, characters) === 'outsider'
	);
	const jumped = game.seating.some((id) =>
		game.seats[id].reminders.some((r) => r.characterId === 'fanggu' && r.label === 'Once')
	);
	for (const id of demons) {
		const cause = game.seats[id].deathCause;
		if (trueCharacter(game, id, characters) !== 'fanggu' || outsiders.length === 0 || jumped) {
			continue;
		}
		if (cause !== 'demon' && cause !== 'fanggu') continue;
		holds.push({ rule: 'fang-gu', characterId: 'fanggu', seats: outsiders, wiki: `${W}Fang_Gu` });
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

/** The good twin: the player with the Evil Twin's "Twin" reminder. */
function twinOf(game: Game): SeatId[] {
	return game.seating.filter((id) =>
		game.seats[id].reminders.some((r) => r.characterId === 'eviltwin' && r.label === 'Twin')
	);
}

/**
 * The Mastermind's extra day (https://wiki.bloodontheclocktower.com/Mastermind): if the
 * Demon's execution would end the game, play one more day; then a player executed loses for
 * their team, and nobody executed means good wins. Returns the end that replaces
 * `demon-dead`, or a hold to add to it, or nothing when no Mastermind is in play.
 */
function mastermind(
	game: Game,
	characters: CharacterLookup,
	options: GameEndOptions,
	end: GameEnd
): GameEnd | GameHold | undefined {
	const masterminds = seatsOf(game, 'mastermind', characters);
	if (masterminds.length === 0) return undefined;
	const logs = days(game);
	const demonDay = logs.findIndex((log) => executedOn(log).some((id) => end.seats.includes(id)));
	const byExecution =
		demonDay !== -1 || end.seats.some((id) => game.seats[id].deathCause === 'execution');
	if (!byExecution) return undefined;
	const extra = demonDay === -1 ? undefined : demonDay + 1;
	const executed = extra === undefined ? [] : executedOn(logs[extra] ?? { entries: [] });
	// The Mastermind must be alive for the extra day; executed on it still counts.
	const mind = masterminds.find((id) => aliveForEnd(game, id, characters) || executed.includes(id));
	if (mind === undefined) return undefined;
	const hold: GameHold = {
		rule: 'mastermind',
		characterId: 'mastermind',
		seats: [mind],
		wiki: `${W}Mastermind`
	};
	if (extra === undefined) return hold;
	if (executed.length > 0) {
		const seatId = executed[0];
		return {
			key: `mastermind:${seatId}`,
			rule: 'mastermind',
			winner: losesFor(game, seatId),
			characterId: 'mastermind',
			seats: [seatId],
			day: extra,
			wiki: `${W}Mastermind`,
			holds: impaired(game, mind, 'mastermind', characters)
		};
	}
	if (endedDays(game, options).includes(extra)) {
		return {
			key: `mastermind:none:${extra}`,
			rule: 'mastermind',
			winner: 'good',
			characterId: 'mastermind',
			seats: [],
			day: extra,
			wiki: `${W}Mastermind`,
			holds: impaired(game, mind, 'mastermind', characters)
		};
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

function saint(game: Game, characters: CharacterLookup): GameEnd[] {
	return seatsOf(game, 'saint', characters)
		.filter((id) => game.seats[id].dead && game.seats[id].deathCause === 'execution')
		.map((id) => ({
			key: `saint:${id}`,
			rule: 'saint',
			winner: losesFor(game, id),
			characterId: 'saint',
			seats: [id],
			wiki: `${W}Saint`,
			holds: impaired(game, id, 'saint', characters)
		}));
}

function evilTwinExecuted(game: Game, characters: CharacterLookup): GameEnd[] {
	const out: GameEnd[] = [];
	for (const evil of seatsOf(game, 'eviltwin', characters)) {
		// A dead Evil Twin has no ability (https://wiki.bloodontheclocktower.com/Evil_Twin).
		if (!aliveForEnd(game, evil, characters)) continue;
		for (const twin of twinOf(game)) {
			const seat = game.seats[twin];
			if (!seat.dead || seat.deathCause !== 'execution') continue;
			out.push({
				key: `evil-twin:${twin}`,
				rule: 'evil-twin',
				winner: 'evil',
				characterId: 'eviltwin',
				seats: [twin, evil],
				wiki: `${W}Evil_Twin`,
				holds: impaired(game, evil, 'eviltwin', characters)
			});
		}
	}
	return out;
}

/** Vortox: each day, if no-one is executed, evil wins (exile doesn't count). */
function vortox(game: Game, characters: CharacterLookup, options: GameEndOptions): GameEnd[] {
	const vortox = seatsOf(game, 'vortox', characters).find((id) =>
		aliveForEnd(game, id, characters)
	);
	if (vortox === undefined) return [];
	const logs = days(game);
	const day = endedDays(game, options).find((d) => executedOn(logs[d]).length === 0);
	if (day === undefined) return [];
	return [
		{
			key: `vortox:${day}`,
			rule: 'vortox',
			winner: 'evil',
			characterId: 'vortox',
			seats: [vortox],
			day,
			wiki: `${W}Vortox`,
			holds: impaired(game, vortox, 'vortox', characters)
		}
	];
}

/**
 * Mayor: at dusk with exactly 3 alive (Travellers count) and no execution today, the Mayor's
 * team wins. The Mayor must be alive; a drunk Mayor is the Drunk, so it doesn't apply
 * (https://wiki.bloodontheclocktower.com/Mayor).
 */
function mayor(game: Game, characters: CharacterLookup, options: GameEndOptions): GameEnd[] {
	if (!options.dayEnded || game.pastDays.length < 1) return [];
	const alive = game.seating.filter((id) => aliveForEnd(game, id, characters));
	if (alive.length !== 3 || executedOn(game.today).length > 0) return [];
	return seatsOf(game, 'mayor', characters)
		.filter((id) => aliveForEnd(game, id, characters))
		.map((id) => ({
			key: `mayor:${game.pastDays.length}`,
			rule: 'mayor',
			winner: alignmentOf(game, id) ?? 'good',
			characterId: 'mayor',
			seats: [id],
			day: game.pastDays.length,
			wiki: `${W}Mayor`,
			holds: impaired(game, id, 'mayor', characters)
		}));
}

/**
 * Leviathan (https://wiki.bloodontheclocktower.com/Leviathan): a second good player executed
 * wins for evil at once; so does the Leviathan being alive at the end of day 5. Good is the
 * alignment the rules use now.
 */
function leviathan(game: Game, characters: CharacterLookup, options: GameEndOptions): GameEnd[] {
	const leviathan = seatsOf(game, 'leviathan', characters).find((id) =>
		aliveForEnd(game, id, characters)
	);
	if (leviathan === undefined) return [];
	const holds = impaired(game, leviathan, 'leviathan', characters);
	const out: GameEnd[] = [];
	const good = days(game)
		.flatMap(executedOn)
		.filter((id) => alignmentOf(game, id) === 'good');
	if (good.length >= 2) {
		out.push({
			key: `leviathan-executions:${good.slice(0, 2).join(',')}`,
			rule: 'leviathan-executions',
			winner: 'evil',
			characterId: 'leviathan',
			seats: good.slice(0, 2),
			wiki: `${W}Leviathan`,
			holds
		});
	}
	if (endedDays(game, options).includes(5)) {
		out.push({
			key: 'leviathan-day-5',
			rule: 'leviathan-day-5',
			winner: 'evil',
			characterId: 'leviathan',
			seats: [leviathan],
			day: 5,
			wiki: `${W}Leviathan`,
			holds
		});
	}
	return out;
}

/**
 * Fearmonger: nominating and executing its chosen player (the "Fear" reminder) makes that
 * player's team lose (https://wiki.bloodontheclocktower.com/Fearmonger).
 */
function fearmonger(game: Game, characters: CharacterLookup): GameEnd[] {
	const out: GameEnd[] = [];
	for (const monger of seatsOf(game, 'fearmonger', characters)) {
		for (const log of days(game)) {
			const executed = executedOn(log);
			for (const entry of log.entries) {
				if (entry.kind !== 'nomination' || entry.nominator !== monger) continue;
				const target = entry.nominee;
				const feared = game.seats[target]?.reminders.some(
					(r) => r.characterId === 'fearmonger' && r.label === 'Fear'
				);
				if (!feared || !executed.includes(target)) continue;
				out.push({
					key: `fearmonger:${target}`,
					rule: 'fearmonger',
					winner: losesFor(game, target),
					characterId: 'fearmonger',
					seats: [target, monger],
					wiki: `${W}Fearmonger`,
					holds: impaired(game, monger, 'fearmonger', characters)
				});
			}
		}
	}
	return out;
}

/**
 * Summoner: there is no Demon until it summons one; once it can't (it died first), good wins
 * (https://wiki.bloodontheclocktower.com/Summoner).
 */
function summoner(game: Game, characters: CharacterLookup): GameEnd[] {
	if (demonSeats(game, characters).length > 0) return [];
	const summoners = seatsOf(game, 'summoner', characters);
	if (summoners.length === 0 || summoners.some((id) => aliveForEnd(game, id, characters)))
		return [];
	return [
		{
			key: `summoner:${summoners.join(',')}`,
			rule: 'summoner',
			winner: 'good',
			characterId: 'summoner',
			seats: summoners,
			wiki: `${W}Summoner`,
			holds: []
		}
	];
}

/**
 * The Heretic: whoever wins, loses, even if the Heretic is dead; not while drunk or poisoned
 * (https://wiki.bloodontheclocktower.com/Heretic).
 */
function heretic(game: Game, characters: CharacterLookup): AbilitySource | undefined {
	const seatId = seatsOf(game, 'heretic', characters).find(
		(id) => abilityState(game, id, characters).impairments.length === 0
	);
	return seatId === undefined ? undefined : { characterId: 'heretic', seatId };
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

	const out: GameEnd[] = [];
	const demon = demonDead(game, characters);
	for (const end of demon) {
		const mind = mastermind(game, characters, options, end);
		if (mind === undefined) out.push(end);
		else if ('key' in mind) out.push(mind);
		else out.push({ ...end, holds: [...end.holds, mind] });
	}
	out.push(
		...saint(game, characters),
		...evilTwinExecuted(game, characters),
		...fearmonger(game, characters),
		...leviathan(game, characters, options),
		...vortox(game, characters, options),
		...mayor(game, characters, options),
		...summoner(game, characters)
	);
	// A dead Demon wins it for good before "just 2 alive" can.
	if (demon.length === 0) out.push(...twoAlive(game, characters));

	const flip = heretic(game, characters);
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
