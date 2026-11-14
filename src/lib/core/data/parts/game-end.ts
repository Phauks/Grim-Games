import { anyOf, B, list, NUM, obj, oneOf, opt, optObj, T, TOKEN } from '../field-spec.ts';
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
	type CharacterType,
	type ReminderLabel
} from '../types.ts';
import type { Issues } from '../validate.ts';
import { presetTable } from '../presets.ts';
import { specPart, partWords } from './part.ts';

/**
 * Ways an ability ends the game, each worked out in `rules/game-end/game-end.ts`:
 * - `executed-loses`: its player dies by execution, so their team loses (the Saint);
 * - `marked-executed`: of its player and the player with its `token`, the one not on `winner`'s
 *   team is executed while the other lives, so `winner` wins (the Evil Twin's "Twin": the good
 *   twin is whichever of the pair is good, even a good-aligned Evil Twin);
 * - `day-without-execution`: while its player lives, a day ends with no execution, so `winner`
 *   wins (the Vortox);
 * - `alive-at-dusk`: at dusk, with exactly `alive` players alive (Travellers count) and no
 *   execution today, its living player's team wins (the Mayor);
 * - `executions-of-alignment`: while its player lives, `count` players of `alignment` have
 *   been executed, so `winner` wins (the Leviathan's second good execution);
 * - `survives-day`: its player is alive when day `day` ends, so `winner` wins (the Leviathan);
 * - `nominated-marked-executed`: its player nominates the player with its `token` and they are
 *   executed, so that player's team loses (the Fearmonger's "Fear");
 * - `dead-without-demon`: there is no Demon and every player of it is dead, so `winner` wins
 *   (the Summoner, who can no longer summon one); with `night`, also once that night is over
 *   and still no Demon was made (the Summoner drunk or poisoned on its 3rd night, M15j). Before
 *   then the game goes on without a Demon;
 * - `extra-day`: the Demon's execution would end the game, so play one more day; then whoever
 *   is executed loses for their team, and nobody executed means good wins (the Mastermind);
 * - `used-on-loses`: its ability is first logged as used (`on` the player it names) and that
 *   player is `on`, an alignment or character type, so the ability's player's team loses (the
 *   Klutz choosing an evil player; a Minion guessing the Damsel, before her spent token);
 * - `executed-with-token`: its player carries its own `token` and is executed, so their team
 *   wins (the Goblin's "Claimed");
 * - `alignment-alive`: while its player lives, at most `alive` players of `alignment` live
 *   (Travellers not counted), so `winner` wins (Legion with one good player left);
 * - `guesses-evil-team`: its player's logged guesses name every Demon as a Demon and every
 *   Minion as a Minion, and nobody else, so `winner` wins (the Alsaahir);
 * - `cult-joined`: its player's vote passed today (`dayUse.vote`, marked when its use is), so
 *   its player's team wins (the Cult Leader's cult,
 *   https://wiki.bloodontheclocktower.com/Cult_Leader);
 * - `storyteller-executed`: the Storyteller is executed while it is in play, even dead, so
 *   `winner` wins (the Atheist). With no such character in play, evil wins
 *   (https://wiki.bloodontheclocktower.com/Atheist).
 *
 * `condition` is the building block (M60, M78): an `event`, what must hold, and what happens.
 * Every kind above is a preset that expands to one (`END_PRESETS`), keeping its name.
 * - `event`:
 *   - `executed`: its `subject` dies by execution: its own player (`self`), a player with its
 *     `token` (`marked`), or either of the two (`either`, with `otherAlive`: the other one lives);
 *   - `day-ends`: a day ends; `dusk`: today ends; `always`: whenever it holds;
 *   - `ability-used`: its ability is first logged as used, naming a player who is `on` (an
 *     alignment or character type); with its own spent token (`dayUse.spentToken`), only the
 *     use that placed it;
 *   - `vote-passed`: its player's vote passed today (`dayUse.vote`, marked when its use is);
 *   - `guessed`: its player's logged guesses name every player of `types` as their character
 *     type, and nobody else;
 *   - `storyteller-executed`: the Storyteller is executed while it is in play, even dead;
 *   - `no-demon`: there is no Demon and every player of it is dead, or `night` is over;
 *   - `demon-executed`: a Demon's execution would end the game (with `then: 'extra-day'`).
 * - what must hold: `carries` (the executed player carries its `token`), `nominatedBySelf` (its
 *   player nominated them), `alignment` (the executed player is of it), `whileAlive` (its
 *   player lives), `noExecution` (none that day), `aliveTotal` (exactly so many players alive,
 *   Travellers count), `onDay` (that day), `executions` (so many players executed so far),
 *   `aliveAtMost` (at most so many players alive, Travellers not counted). The players
 *   `executions` and `aliveAtMost` count are those of `alignment` and of one of `types` (M78),
 *   each when given: "no Demon alive" is `aliveAtMost: 0` with `types: ["demon"]`;
 * - what happens: `winner`, a team, or `wins`: `own` (its player's team), `other` (the team its
 *   player is not on) or `opposing` (the team the executed player is not on); or `then:
 *   'extra-day'`: play one more day, then whoever is executed loses for their team, and nobody
 *   executed means good wins.
 */
const END_KINDS = [
	'condition',
	'executed-loses',
	'marked-executed',
	'day-without-execution',
	'alive-at-dusk',
	'executions-of-alignment',
	'survives-day',
	'nominated-marked-executed',
	'dead-without-demon',
	'extra-day',
	'used-on-loses',
	'executed-with-token',
	'alignment-alive',
	'guesses-evil-team',
	'cult-joined',
	'storyteller-executed'
] as const;
export type EndKind = (typeof END_KINDS)[number];
const END_EVENTS = [
	'executed',
	'day-ends',
	'dusk',
	'always',
	'ability-used',
	'vote-passed',
	'guessed',
	'storyteller-executed',
	'no-demon',
	'demon-executed'
] as const;
export type EndEvent = (typeof END_EVENTS)[number];
const END_SUBJECTS = ['self', 'marked', 'either'] as const;
const END_WINS = ['own', 'other', 'opposing'] as const;
const END_THEN = ['extra-day'] as const;
export interface EndsGame {
	kind: EndKind;
	/** For a `condition` written as an official kind, that kind. */
	preset?: EndKind;
	event?: (typeof END_EVENTS)[number];
	subject?: (typeof END_SUBJECTS)[number];
	carries?: true;
	nominatedBySelf?: true;
	/** For `subject: 'either'`: the one not executed lives. */
	otherAlive?: true;
	whileAlive?: true;
	noExecution?: true;
	aliveTotal?: number;
	onDay?: number;
	executions?: number;
	aliveAtMost?: number;
	wins?: (typeof END_WINS)[number];
	then?: (typeof END_THEN)[number];
	token?: ReminderLabel;
	winner?: Alignment;
	alive?: number;
	alignment?: Alignment;
	/** For a `condition`'s counts: players of one of these character types. */
	types?: readonly CharacterType[];
	count?: number;
	day?: number;
	night?: number;
	on?: Alignment | CharacterType;
}

/**
 * Ways an ability may keep the game going once every Demon is dead. `condition` is the
 * building block (M78): what must hold, then what may happen.
 * - what must hold: `whileAlive` (its player lives), `token` (the player with its token lives
 *   too), `aliveAtLeast` (so many players, not Travellers, still alive), `ownKill` (this Demon
 *   died by its own kill), `spentToken` (unless its token marks that it already happened);
 * - `then`: `blocks-good` (good can't win), `becomes-demon` (its player may become the Demon)
 *   or `demon-passes` (a living player of type `to` may become this Demon).
 * The official kinds are presets that expand to one (`HOLD_PRESETS`), keeping their name:
 * - `marked-alive`: its living player and the player with its `token` are both alive, so good
 *   can't win (the Evil Twin);
 * - `becomes-demon`: its living player may become the Demon while `aliveAtLeast` players
 *   (not Travellers) are still alive (the Scarlet Woman: 5 or more before the Demon died);
 * - `death-passes`: this Demon died by its own kill, so a living `to` player may become it,
 *   until its `spentToken` marks that it happened (the Imp to a Minion; the Fang Gu to an
 *   Outsider, once).
 */
const HOLD_KINDS = ['condition', 'marked-alive', 'becomes-demon', 'death-passes'] as const;
export type HoldKind = (typeof HOLD_KINDS)[number];
const HOLD_THEN = ['blocks-good', 'becomes-demon', 'demon-passes'] as const;
export type HoldThen = (typeof HOLD_THEN)[number];
export interface HoldsGame {
	kind: HoldKind;
	/** For a `condition` written as an official kind, that kind. */
	preset?: HoldKind;
	then?: HoldThen;
	whileAlive?: true;
	ownKill?: true;
	token?: ReminderLabel;
	aliveAtLeast?: number;
	to?: CharacterType;
	spentToken?: ReminderLabel;
}

/** The official holds, each the `condition` it is a preset of. */
const HOLD_PRESETS = presetTable<Exclude<HoldKind, 'condition'>, HoldsGame, HoldsGame>({
	'marked-alive': (h) => ({
		kind: 'condition',
		then: 'blocks-good',
		whileAlive: true,
		token: h.token
	}),
	'becomes-demon': (h) => ({
		kind: 'condition',
		then: 'becomes-demon',
		whileAlive: true,
		aliveAtLeast: h.aliveAtLeast
	}),
	'death-passes': (h) => ({
		kind: 'condition',
		then: 'demon-passes',
		ownKill: true,
		to: h.to,
		...(h.spentToken ? { spentToken: h.spentToken } : {})
	})
});

/**
 * - `ends` / `holds`: above;
 * - `aliveWhileDead`: marked dead, its player is still alive for the game's end while sober:
 *   until its `untilToken` marks the real death (the Zombuul's "Dead"), or while the player with
 *   its `whileCarrierAlive` token lives (the Lleech's host, "Poisoned");
 * - `invertWinner`: whoever wins loses, even if its player is dead, unless drunk or poisoned
 *   (the Heretic);
 * - `decidedByStoryteller`: the ability can decide the game through a public claim, guess or
 *   choice only the Storyteller sees, so End game offers it as a reason but nothing checks it
 *   (the Atheist, Cult Leader, Fiddler);
 * - `joinsWinner`: its player may win with whichever team wins, whatever their alignment and
 *   even if dead, when the Storyteller judges their ability met (the Politician, most
 *   responsible for their own team losing). End game offers it as a reason, and
 *   `joinsWinners` lists who may win too; nothing checks it;
 * - `alwaysWinsWith`: its player wins whenever this team wins, whatever their alignment and
 *   even if dead, with no call to make (`alwaysWinners`). Their alignment never changes (Trevor,
 *   2026-11-03: "politician always wins with good ... their alignment does not shift");
 * - `contest`: the game can end in a contest between a player of `chooser`'s type and a player
 *   of the other alignment they choose; the player with the most votes wins for their team, and
 *   `tie` wins a tie (the Fiddler's: the Demon chooses, evil wins a tie,
 *   https://wiki.bloodontheclocktower.com/Fiddler). Worked out in `rules/game-end/contest.ts`.
 */
export interface GameEndRules {
	ends?: readonly EndsGame[];
	holds?: readonly HoldsGame[];
	aliveWhileDead?: { untilToken?: ReminderLabel; whileCarrierAlive?: ReminderLabel };
	invertWinner?: boolean;
	decidedByStoryteller?: boolean;
	joinsWinner?: boolean;
	alwaysWinsWith?: Alignment;
	contest?: { chooser: CharacterType; tie: Alignment };
}

/** The parameters each kind needs. */
const END_NEEDS: Readonly<Record<EndKind, readonly (keyof EndsGame)[]>> = {
	condition: [],
	'executed-loses': [],
	'marked-executed': ['token', 'winner'],
	'day-without-execution': ['winner'],
	'alive-at-dusk': ['alive'],
	'executions-of-alignment': ['alignment', 'count', 'winner'],
	'survives-day': ['day', 'winner'],
	'nominated-marked-executed': ['token'],
	'dead-without-demon': ['winner', 'night'],
	'extra-day': [],
	'used-on-loses': ['on'],
	'executed-with-token': ['token'],
	'alignment-alive': ['alignment', 'alive', 'winner'],
	'guesses-evil-team': ['winner'],
	'cult-joined': [],
	'storyteller-executed': ['winner']
};
/** Parameters a kind may leave out. */
const OPTIONAL: ReadonlySet<string> = new Set(['spentToken', 'night']);
const HOLD_NEEDS: Readonly<Record<HoldKind, readonly (keyof HoldsGame)[]>> = {
	condition: [],
	'marked-alive': ['token'],
	'becomes-demon': ['aliveAtLeast'],
	'death-passes': ['to']
};

const CONDITION_FLAGS = [
	'carries',
	'nominatedBySelf',
	'otherAlive',
	'whileAlive',
	'noExecution'
] as const;
const CONDITION_COUNTS = ['aliveTotal', 'onDay', 'executions', 'aliveAtMost', 'night'] as const;

const CONDITION_KEYS: readonly string[] = [
	'kind',
	'event',
	'subject',
	'token',
	'alignment',
	'types',
	'winner',
	'wins',
	'then',
	'on',
	...CONDITION_FLAGS,
	...CONDITION_COUNTS
];
const HOLD_CONDITION_KEYS: readonly string[] = [
	'kind',
	'then',
	'whileAlive',
	'ownKill',
	'token',
	'aliveAtLeast',
	'to',
	'spentToken'
];

/** Reports settings an entry has but its kind doesn't take, and ones it needs but lacks. */
function checkKeys(
	entry: object,
	allowed: readonly string[],
	needs: readonly string[],
	path: string,
	issues: Issues
) {
	for (const key of Object.keys(entry))
		if (!allowed.includes(key)) issues.add(`${path}.${key}`, 'unknown field');
	for (const key of needs)
		if (!(key in entry) && !OPTIONAL.has(key)) issues.add(`${path}.${key}`, 'missing');
}

/** One `ends` entry, a preset expanded to its `condition`. */
function readEnd(e: EndsGame, path: string, issues: Issues): EndsGame {
	if (e.kind !== 'condition') {
		checkKeys(e, ['kind', ...END_NEEDS[e.kind]], END_NEEDS[e.kind], path, issues);
		return END_PRESETS.expand(e.kind, e);
	}
	checkKeys(e, CONDITION_KEYS, ['event'], path, issues);
	if (e.event) checkCondition(e, path, issues);
	return e;
}

/** One `holds` entry, a preset expanded to its `condition`. */
function readHold(h: HoldsGame, path: string, issues: Issues): HoldsGame {
	if (h.kind !== 'condition') {
		const needs = h.kind === 'death-passes' ? ['to', 'spentToken'] : HOLD_NEEDS[h.kind];
		checkKeys(h, ['kind', ...needs], needs, path, issues);
		return HOLD_PRESETS.expand(h.kind, h);
	}
	checkKeys(h, HOLD_CONDITION_KEYS, ['then'], path, issues);
	if (h.then === 'demon-passes' && !h.to) issues.add(`${path}.to`, 'missing');
	if (h.to && h.then !== 'demon-passes') issues.add(`${path}.to`, 'only `demon-passes` takes it');
	return h;
}

/** What a condition needs to be worked out. */
function checkCondition(c: EndsGame, path: string, issues: Issues) {
	const executed = c.event === 'executed';
	if (executed && !c.subject) issues.add(`${path}.subject`, 'missing');
	if (!executed && c.subject) issues.add(`${path}.subject`, 'only an `executed` event has one');
	if (!executed && (c.carries || c.nominatedBySelf))
		issues.add(path, '`carries` and `nominatedBySelf` are about who was executed');
	if ((c.subject === 'marked' || c.subject === 'either' || c.carries) && !c.token)
		issues.add(`${path}.token`, 'missing');
	if (c.otherAlive && c.subject !== 'either')
		issues.add(`${path}.otherAlive`, 'only with `subject: "either"`');
	const counts = c.executions !== undefined || c.aliveAtMost !== undefined;
	if (counts && !c.alignment && !c.types)
		issues.add(path, 'a count needs who it counts: `alignment` or `types`');
	if (c.types && !counts && c.event !== 'guessed')
		issues.add(`${path}.types`, 'only `executions`, `aliveAtMost` and `guessed` take it');
	if (c.event === 'guessed' && !c.types) issues.add(`${path}.types`, 'missing');
	if (c.alignment && !counts && !executed)
		issues.add(`${path}.alignment`, 'only a count or an `executed` event takes it');
	if (c.event === 'always' && !counts)
		issues.add(path, 'an `always` event needs `executions` or `aliveAtMost`');
	if (c.event === 'ability-used' && !c.on) issues.add(`${path}.on`, 'missing');
	if (c.on && c.event !== 'ability-used') issues.add(`${path}.on`, 'only `ability-used` takes it');
	if (c.night !== undefined && c.event !== 'no-demon')
		issues.add(`${path}.night`, 'only `no-demon` takes it');
	if (c.event === 'demon-executed' && !c.then) issues.add(`${path}.then`, 'missing');
	if (c.then && c.event !== 'demon-executed')
		issues.add(`${path}.then`, 'only `demon-executed` takes it');
	if (!c.then && !c.winner === !c.wins) issues.add(path, 'needs one of `winner` and `wins`');
	if (c.then && (c.winner || c.wins)) issues.add(path, '`then` says who wins');
	if (c.wins === 'opposing' && !executed)
		issues.add(`${path}.wins`, '`opposing` is about who was executed');
}

/** Who wins, when the entry names a team. */
const teamOf = (e: EndsGame) => (e.winner ? { winner: e.winner } : {});

/** The official kinds, each the `condition` it is a preset of. */
const END_PRESETS = presetTable<Exclude<EndKind, 'condition'>, EndsGame, EndsGame>({
	'executed-loses': {
		kind: 'condition',
		event: 'executed',
		subject: 'self',
		wins: 'opposing'
	},
	'executed-with-token': (e) => ({
		kind: 'condition',
		event: 'executed',
		subject: 'self',
		carries: true,
		token: e.token,
		wins: 'own'
	}),
	'nominated-marked-executed': (e) => ({
		kind: 'condition',
		event: 'executed',
		subject: 'marked',
		token: e.token,
		nominatedBySelf: true,
		wins: 'opposing'
	}),
	'day-without-execution': (e) => ({
		kind: 'condition',
		event: 'day-ends',
		whileAlive: true,
		noExecution: true,
		...teamOf(e)
	}),
	'alive-at-dusk': (e) => ({
		kind: 'condition',
		event: 'dusk',
		whileAlive: true,
		noExecution: true,
		aliveTotal: e.alive,
		wins: 'own'
	}),
	'survives-day': (e) => ({
		kind: 'condition',
		event: 'day-ends',
		whileAlive: true,
		onDay: e.day,
		...teamOf(e)
	}),
	'executions-of-alignment': (e) => ({
		kind: 'condition',
		event: 'always',
		whileAlive: true,
		alignment: e.alignment,
		executions: e.count,
		...teamOf(e)
	}),
	'alignment-alive': (e) => ({
		kind: 'condition',
		event: 'always',
		whileAlive: true,
		alignment: e.alignment,
		aliveAtMost: e.alive,
		...teamOf(e)
	}),
	'marked-executed': (e) => ({
		kind: 'condition',
		event: 'executed',
		subject: 'either',
		token: e.token,
		alignment: e.winner === 'good' ? 'evil' : 'good',
		otherAlive: true,
		...teamOf(e)
	}),
	'dead-without-demon': (e) => ({
		kind: 'condition',
		event: 'no-demon',
		...(e.night !== undefined ? { night: e.night } : {}),
		...teamOf(e)
	}),
	'extra-day': { kind: 'condition', event: 'demon-executed', then: 'extra-day' },
	'used-on-loses': (e) => ({ kind: 'condition', event: 'ability-used', on: e.on, wins: 'other' }),
	'guesses-evil-team': (e) => ({
		kind: 'condition',
		event: 'guessed',
		types: ['demon', 'minion'],
		...teamOf(e)
	}),
	'cult-joined': { kind: 'condition', event: 'vote-passed', wins: 'own' },
	'storyteller-executed': (e) => ({
		kind: 'condition',
		event: 'storyteller-executed',
		...teamOf(e)
	})
});

/**
 * How a character's ability ends the game, keeps it going or changes who wins: the `gameEnd`
 * part of its rules block, read here and worked out in `rules/game-end/game-end.ts`. Each entry names
 * a behaviour and its parameters, never a character.
 */
export const gameEnd = partWords(
	specPart(
		'deaths',
		'Game end',
		'How the ability ends the game, keeps it going, or changes who wins.',
		obj({
			ends: opt(
				list(
					obj({
						kind: oneOf(END_KINDS),
						event: opt(oneOf(END_EVENTS)),
						subject: opt(oneOf(END_SUBJECTS)),
						carries: opt(T),
						otherAlive: opt(T),
						nominatedBySelf: opt(T),
						whileAlive: opt(T),
						noExecution: opt(T),
						aliveTotal: opt(NUM),
						onDay: opt(NUM),
						executions: opt(NUM),
						aliveAtMost: opt(NUM),
						wins: opt(oneOf(END_WINS)),
						then: opt(oneOf(END_THEN)),
						token: opt(TOKEN),
						winner: opt(oneOf(ALIGNMENTS)),
						alive: opt(NUM),
						alignment: opt(oneOf(ALIGNMENTS)),
						types: opt(anyOf(CHARACTER_TYPES)),
						count: opt(NUM),
						day: opt(NUM),
						night: opt(NUM),
						on: opt(oneOf([...ALIGNMENTS, ...CHARACTER_TYPES]))
					})
				)
			),
			holds: opt(
				list(
					obj({
						kind: oneOf(HOLD_KINDS),
						then: opt(oneOf(HOLD_THEN)),
						whileAlive: opt(T),
						ownKill: opt(T),
						token: opt(TOKEN),
						aliveAtLeast: opt(NUM),
						to: opt(oneOf(CHARACTER_TYPES)),
						spentToken: opt(TOKEN)
					})
				)
			),
			aliveWhileDead: opt(optObj({ untilToken: TOKEN, whileCarrierAlive: TOKEN })),
			invertWinner: opt(B),
			decidedByStoryteller: opt(B),
			joinsWinner: opt(B),
			alwaysWinsWith: opt(oneOf(ALIGNMENTS)),
			contest: opt(obj({ chooser: oneOf(CHARACTER_TYPES), tie: oneOf(ALIGNMENTS) }))
		}),
		(value, path, issues): GameEndRules | undefined => {
			const before = issues.list.length;
			const { ends, holds, ...rest } = value;
			const out: GameEndRules = {
				...rest,
				...(ends ? { ends: ends.map((e, i) => readEnd(e, `${path}.ends[${i}]`, issues)) } : {}),
				...(holds ? { holds: holds.map((h, i) => readHold(h, `${path}.holds[${i}]`, issues)) } : {})
			};
			return issues.list.length > before ? undefined : out;
		}
	),
	{
		ends: {
			label: 'Ways it ends the game'
		},
		'ends.*.kind': {
			label: 'How',
			names: {
				condition: 'When these hold',
				'executed-loses': 'Its player executed: their team loses',
				'marked-executed': 'Of its player and the marked player, one executed',
				'day-without-execution': 'A day ends with no execution',
				'alive-at-dusk': 'So many alive at dusk, no execution',
				'executions-of-alignment': 'So many of an alignment executed',
				'survives-day': 'Its player survives a day',
				'nominated-marked-executed': 'Its player nominates the marked player, who is executed',
				'dead-without-demon': 'No Demon and its players dead',
				'extra-day': 'One more day after the Demon’s execution',
				'used-on-loses': 'Its ability used on the wrong player',
				'executed-with-token': 'Its player executed while marked: their team wins',
				'alignment-alive': 'At most so many of an alignment alive',
				'guesses-evil-team': 'Its player guesses the evil team',
				'cult-joined': 'Its player’s vote passed',
				'storyteller-executed': 'The Storyteller is executed'
			}
		},
		'ends.*.event': {
			label: 'When',
			names: {
				executed: 'A player is executed',
				'day-ends': 'A day ends',
				dusk: 'At dusk',
				always: 'Whenever it holds',
				'ability-used': 'Its ability is first used',
				'vote-passed': 'Its player’s vote passed',
				guessed: 'Its player’s guesses are right',
				'storyteller-executed': 'The Storyteller is executed',
				'no-demon': 'There is no Demon',
				'demon-executed': 'The Demon’s execution would end the game'
			}
		},
		'ends.*.subject': {
			label: 'Executed player',
			names: {
				self: 'Its own player',
				marked: 'The player with its reminder',
				either: 'Either of the two'
			}
		},
		'ends.*.carries': {
			label: 'Executed player has its reminder'
		},
		'ends.*.otherAlive': {
			label: 'The other one lives'
		},
		'ends.*.nominatedBySelf': {
			label: 'Nominated by its player'
		},
		'ends.*.whileAlive': {
			label: 'While its player lives'
		},
		'ends.*.noExecution': {
			label: 'No execution that day'
		},
		'ends.*.aliveTotal': {
			label: 'Exactly this many alive',
			about: 'Travellers count.'
		},
		'ends.*.onDay': {
			label: 'On day'
		},
		'ends.*.executions': {
			label: 'Executed so far'
		},
		'ends.*.aliveAtMost': {
			label: 'At most this many alive',
			about: 'Travellers do not count.'
		},
		'ends.*.wins': {
			label: 'Who wins',
			names: {
				own: 'Its player’s team',
				other: 'The other team',
				opposing: 'The executed player’s other team'
			}
		},
		'ends.*.then': {
			label: 'Then',
			names: {
				'extra-day': 'Play one more day'
			}
		},
		'ends.*.token': {
			label: 'Reminder'
		},
		'ends.*.winner': {
			label: 'Winning team'
		},
		'ends.*.alive': {
			label: 'Players alive'
		},
		'ends.*.alignment': {
			label: 'Alignment'
		},
		'ends.*.types': {
			label: 'Character types'
		},
		'ends.*.count': {
			label: 'How many'
		},
		'ends.*.day': {
			label: 'Day'
		},
		'ends.*.night': {
			label: 'Or once night is over'
		},
		'ends.*.on': {
			label: 'Used on a player who is'
		},
		holds: {
			label: 'Ways it keeps the game going',
			about: 'Once every Demon is dead.'
		},
		'holds.*.kind': {
			label: 'How',
			names: {
				condition: 'When these hold',
				'marked-alive': 'Its player and the marked player both alive',
				'becomes-demon': 'Its player may become the Demon',
				'death-passes': 'The Demon passes on after killing itself'
			}
		},
		'holds.*.then': {
			label: 'Then',
			names: {
				'blocks-good': 'Good can’t win',
				'becomes-demon': 'Its player may become the Demon',
				'demon-passes': 'A player of a type may become the Demon'
			}
		},
		'holds.*.whileAlive': {
			label: 'While its player lives'
		},
		'holds.*.ownKill': {
			label: 'The Demon died by its own kill'
		},
		'holds.*.token': {
			label: 'While the player with it lives'
		},
		'holds.*.aliveAtLeast': {
			label: 'At least this many alive',
			about: 'Travellers do not count.'
		},
		'holds.*.to': {
			label: 'Passes to type'
		},
		'holds.*.spentToken': {
			label: 'Used up by'
		},
		aliveWhileDead: {
			label: 'Alive for the game’s end while dead'
		},
		'aliveWhileDead.untilToken': {
			label: 'Until its player has'
		},
		'aliveWhileDead.whileCarrierAlive': {
			label: 'While the player with it lives'
		},
		invertWinner: {
			label: 'Whoever wins loses'
		},
		decidedByStoryteller: {
			label: 'Storyteller decides',
			about: 'A claim or choice only the Storyteller sees can end the game.'
		},
		joinsWinner: {
			label: 'May join the winners',
			about: 'When the Storyteller judges its ability met.'
		},
		alwaysWinsWith: {
			label: 'Always wins with'
		},
		contest: {
			label: 'A contest may end the game'
		},
		'contest.chooser': {
			label: 'Chosen by type'
		},
		'contest.tie': {
			label: 'A tie goes to'
		}
	}
);
