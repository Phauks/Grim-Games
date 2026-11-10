/**
 * How a character's ability ends the game, keeps it going or changes who wins: the `gameEnd`
 * part of its rules block, read here and worked out in `rules/game-end.ts`. Each entry names
 * a behaviour and its parameters, never a character.
 */
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
	type CharacterType,
	type ReminderLabel
} from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readString,
	type Issues
} from './validate.ts';
import { readTypes } from './target-rules.ts';

/**
 * Ways an ability ends the game, each worked out in `rules/game-end.ts`:
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
 * Every kind above is a preset that expands to one (`presetCondition`), keeping its name.
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
 * The official kinds are presets that expand to one (`presetHold`), keeping their name:
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

/** The `condition` an official hold is, with that kind as its preset. */
function presetHold(h: HoldsGame): HoldsGame {
	const base = { kind: 'condition' as const, preset: h.kind };
	switch (h.kind) {
		case 'marked-alive':
			return { ...base, then: 'blocks-good', whileAlive: true, token: h.token };
		case 'becomes-demon':
			return { ...base, then: 'becomes-demon', whileAlive: true, aliveAtLeast: h.aliveAtLeast };
		case 'death-passes':
			return {
				...base,
				then: 'demon-passes',
				ownKill: true,
				to: h.to,
				...(h.spentToken ? { spentToken: h.spentToken } : {})
			};
		default:
			return h;
	}
}

/** A `condition` hold: what must hold, then what may happen. */
function readHoldCondition(
	raw: Record<string, unknown>,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): HoldsGame | undefined {
	checkKeys(
		raw,
		['kind', 'then', 'whileAlive', 'ownKill', 'token', 'aliveAtLeast', 'to', 'spentToken'],
		path,
		issues
	);
	const then = readEnum(raw, 'then', HOLD_THEN, path, issues, true);
	const token = readToken(raw, 'token', path, issues, reminders);
	const spentToken = readToken(raw, 'spentToken', path, issues, reminders);
	const to = readEnum(raw, 'to', CHARACTER_TYPES, path, issues, false);
	const aliveAtLeast = readNumber(raw, 'aliveAtLeast', path, issues);
	if (!then) return undefined;
	const out: HoldsGame = { kind: 'condition', then };
	if (readBoolean(raw, 'whileAlive', path, issues)) out.whileAlive = true;
	if (readBoolean(raw, 'ownKill', path, issues)) out.ownKill = true;
	if (token) out.token = token;
	if (spentToken) out.spentToken = spentToken;
	if (to) out.to = to;
	if (aliveAtLeast !== undefined) out.aliveAtLeast = aliveAtLeast;
	if (then === 'demon-passes' && !to) issues.add(`${path}.to`, 'missing');
	if (to && then !== 'demon-passes') issues.add(`${path}.to`, 'only `demon-passes` takes it');
	return out;
}

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
 *   https://wiki.bloodontheclocktower.com/Fiddler). Worked out in `rules/contest.ts`.
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

function ownReminder(token: string, reminders: readonly ReminderLabel[] | undefined): boolean {
	return !reminders || reminders.some((r) => r.toLowerCase() === token.toLowerCase());
}

function readToken(
	raw: Record<string, unknown>,
	key: string,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): ReminderLabel | undefined {
	const token = readString(raw, key, path, issues, false);
	if (token === undefined) return undefined;
	if (!ownReminder(token, reminders)) {
		issues.add(`${path}.${key}`, 'not one of this character’s reminders');
		return undefined;
	}
	return token;
}

/** One `ends` or `holds` entry: its kind, then the parameters that kind needs. */
function readKind<K extends string, T extends { kind: K }>(
	raw: unknown,
	path: string,
	issues: Issues,
	kinds: readonly K[],
	needs: Readonly<Record<K, readonly string[]>>,
	reminders: readonly ReminderLabel[] | undefined
): T | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const kind = readEnum(raw, 'kind', kinds, path, issues, true);
	if (!kind) return undefined;
	if (kind === 'condition') {
		const read = kinds.includes('marked-alive' as K)
			? readHoldCondition(raw, path, issues, reminders)
			: readCondition(raw, path, issues, reminders);
		return read as T | undefined;
	}
	checkKeys(raw, ['kind', ...needs[kind]], path, issues);
	const out: Record<string, unknown> = { kind };
	for (const key of needs[kind]) {
		let value: unknown;
		if (key === 'token' || key === 'spentToken')
			value = readToken(raw, key, path, issues, reminders);
		else if (key === 'winner' || key === 'alignment')
			value = readEnum(raw, key, ALIGNMENTS, path, issues, false);
		else if (key === 'to') value = readEnum(raw, key, CHARACTER_TYPES, path, issues, false);
		else if (key === 'on')
			value = readEnum(raw, key, [...ALIGNMENTS, ...CHARACTER_TYPES], path, issues, false);
		else value = readNumber(raw, key, path, issues);
		if (raw[key] === undefined && !OPTIONAL.has(key)) issues.add(`${path}.${key}`, 'missing');
		if (value !== undefined) out[key] = value;
	}
	return out as T;
}

const CONDITION_FLAGS = [
	'carries',
	'nominatedBySelf',
	'otherAlive',
	'whileAlive',
	'noExecution'
] as const;
const CONDITION_COUNTS = ['aliveTotal', 'onDay', 'executions', 'aliveAtMost', 'night'] as const;

/** A `condition` end: its event, what must hold and who wins. */
function readCondition(
	raw: Record<string, unknown>,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): EndsGame | undefined {
	checkKeys(
		raw,
		[
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
		],
		path,
		issues
	);
	const event = readEnum(raw, 'event', END_EVENTS, path, issues, true);
	const out: EndsGame = { kind: 'condition' };
	const subject = readEnum(raw, 'subject', END_SUBJECTS, path, issues, false);
	const token = readToken(raw, 'token', path, issues, reminders);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
	const types = readTypes(raw, 'types', path, issues);
	const winner = readEnum(raw, 'winner', ALIGNMENTS, path, issues, false);
	const wins = readEnum(raw, 'wins', END_WINS, path, issues, false);
	const then = readEnum(raw, 'then', END_THEN, path, issues, false);
	const on = readEnum(raw, 'on', [...ALIGNMENTS, ...CHARACTER_TYPES], path, issues, false);
	if (!event) return undefined;
	if (types) out.types = types;
	if (then) out.then = then;
	if (on) out.on = on;
	out.event = event;
	if (subject) out.subject = subject;
	if (token) out.token = token;
	if (alignment) out.alignment = alignment;
	if (winner) out.winner = winner;
	if (wins) out.wins = wins;
	for (const key of CONDITION_FLAGS) if (readBoolean(raw, key, path, issues)) out[key] = true;
	for (const key of CONDITION_COUNTS) {
		const n = readNumber(raw, key, path, issues);
		if (n !== undefined) out[key] = n;
	}
	checkCondition(out, path, issues);
	return out;
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

/** The `condition` an official kind is, with that kind as its preset, or undefined. */
function presetCondition(e: EndsGame): EndsGame | undefined {
	const base = { kind: 'condition' as const, preset: e.kind };
	const team = e.winner ? { winner: e.winner } : {};
	switch (e.kind) {
		case 'executed-loses':
			return { ...base, event: 'executed', subject: 'self', wins: 'opposing' };
		case 'executed-with-token':
			return {
				...base,
				event: 'executed',
				subject: 'self',
				carries: true,
				token: e.token,
				wins: 'own'
			};
		case 'nominated-marked-executed':
			return {
				...base,
				event: 'executed',
				subject: 'marked',
				token: e.token,
				nominatedBySelf: true,
				wins: 'opposing'
			};
		case 'day-without-execution':
			return { ...base, event: 'day-ends', whileAlive: true, noExecution: true, ...team };
		case 'alive-at-dusk':
			return {
				...base,
				event: 'dusk',
				whileAlive: true,
				noExecution: true,
				aliveTotal: e.alive,
				wins: 'own'
			};
		case 'survives-day':
			return { ...base, event: 'day-ends', whileAlive: true, onDay: e.day, ...team };
		case 'executions-of-alignment':
			return {
				...base,
				event: 'always',
				whileAlive: true,
				alignment: e.alignment,
				executions: e.count,
				...team
			};
		case 'alignment-alive':
			return {
				...base,
				event: 'always',
				whileAlive: true,
				alignment: e.alignment,
				aliveAtMost: e.alive,
				...team
			};
		case 'marked-executed':
			return {
				...base,
				event: 'executed',
				subject: 'either',
				token: e.token,
				alignment: e.winner === 'good' ? 'evil' : 'good',
				otherAlive: true,
				...team
			};
		case 'dead-without-demon':
			return {
				...base,
				event: 'no-demon',
				...(e.night !== undefined ? { night: e.night } : {}),
				...team
			};
		case 'extra-day':
			return { ...base, event: 'demon-executed', then: 'extra-day' };
		case 'used-on-loses':
			return { ...base, event: 'ability-used', on: e.on, wins: 'other' };
		case 'guesses-evil-team':
			return { ...base, event: 'guessed', types: ['demon', 'minion'], ...team };
		case 'cult-joined':
			return { ...base, event: 'vote-passed', wins: 'own' };
		case 'storyteller-executed':
			return { ...base, event: 'storyteller-executed', ...team };
		default:
			return undefined;
	}
}

export function readGameEnd(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): GameEndRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		[
			'ends',
			'holds',
			'aliveWhileDead',
			'invertWinner',
			'decidedByStoryteller',
			'joinsWinner',
			'alwaysWinsWith',
			'contest'
		],
		path,
		issues
	);
	const out: GameEndRules = {};
	for (const key of ['ends', 'holds'] as const) {
		if (raw[key] === undefined) continue;
		const list = raw[key];
		if (!Array.isArray(list)) {
			issues.add(`${path}.${key}`, `expected array, got ${describe(list)}`);
			continue;
		}
		const read = list.map((entry, i) =>
			key === 'ends'
				? readKind<EndKind, EndsGame>(
						entry,
						`${path}.${key}[${i}]`,
						issues,
						END_KINDS,
						END_NEEDS,
						reminders
					)
				: readKind<HoldKind, HoldsGame>(
						entry,
						`${path}.${key}[${i}]`,
						issues,
						HOLD_KINDS,
						{ ...HOLD_NEEDS, 'death-passes': ['to', 'spentToken'] },
						reminders
					)
		);
		if (key === 'ends')
			out.ends = read
				.filter((e): e is EndsGame => e !== undefined)
				.map((e) => presetCondition(e as EndsGame) ?? (e as EndsGame));
		else
			out.holds = read
				.filter((e): e is HoldsGame => e !== undefined)
				.map((h) => presetHold(h as HoldsGame));
	}
	if (raw.aliveWhileDead !== undefined) {
		const at = `${path}.aliveWhileDead`;
		if (!isObject(raw.aliveWhileDead)) {
			issues.add(at, `expected object, got ${describe(raw.aliveWhileDead)}`);
		} else {
			checkKeys(raw.aliveWhileDead, ['untilToken', 'whileCarrierAlive'], at, issues);
			const untilToken = readToken(raw.aliveWhileDead, 'untilToken', at, issues, reminders);
			const whileCarrierAlive = readToken(
				raw.aliveWhileDead,
				'whileCarrierAlive',
				at,
				issues,
				reminders
			);
			out.aliveWhileDead = {
				...(untilToken ? { untilToken } : {}),
				...(whileCarrierAlive ? { whileCarrierAlive } : {})
			};
		}
	}
	if (raw.contest !== undefined) {
		const at = `${path}.contest`;
		if (!isObject(raw.contest)) {
			issues.add(at, `expected object, got ${describe(raw.contest)}`);
		} else {
			checkKeys(raw.contest, ['chooser', 'tie'], at, issues);
			const chooser = readEnum(raw.contest, 'chooser', CHARACTER_TYPES, at, issues, true);
			const tie = readEnum(raw.contest, 'tie', ALIGNMENTS, at, issues, true);
			if (chooser && tie) out.contest = { chooser, tie };
		}
	}
	const always = readEnum(raw, 'alwaysWinsWith', ALIGNMENTS, path, issues, false);
	if (always) out.alwaysWinsWith = always;
	for (const key of ['invertWinner', 'decidedByStoryteller', 'joinsWinner'] as const) {
		const value = readBoolean(raw, key, path, issues);
		if (value !== undefined) out[key] = value;
	}
	return out;
}
