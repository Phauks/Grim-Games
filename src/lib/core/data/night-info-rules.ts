/**
 * The `learns` and `answers` parts of a character's rules block: what its night information
 * is, worked out in `rules/night-info.ts`.
 */
import { readTypes } from './target-rules.ts';
import { readToken } from './reminder-fields.ts';
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
	type Issues
} from './validate.ts';

/**
 * The building blocks (M60, M78): an answer over a group of players.
 * - `count`: how many players match, among the waking player's alive neighbours
 *   (`scope: 'alive-neighbours'`), the pairs of neighbours who both match
 *   (`'neighbour-pairs'`), everyone, or each `choose` players chosen;
 * - `players`: `choose` players shown, `matching` of them matching (all when left out);
 * - `any-of`: yes when any of `choose` chosen players matches;
 * - `character`: a player's character. With `choose: 1`, one player who matches (any player
 *   when nobody matching is named); with `choose: 2`, one who matches and anyone else, shown
 *   which is which; `noneWhenAbsent` lets it learn nobody matches;
 * - `same`: yes when the `choose` chosen players are all one alignment;
 * - `alignment`: the alignment of the `choose` chosen player;
 * - `direction`: whether the closest player who matches sits clockwise or anticlockwise,
 *   counting dead players' seats;
 * - `distance`: the fewest steps round the circle from a player who matches to one of the
 *   `to` character types;
 * - `storyteller`: `choose` players the Storyteller picks by their own judgement, so any
 *   player is valid.
 * A player matches when they register as every one of `alignment`, `types` and `woke`
 * (woke tonight by their own ability) that is given, or carry this character's `token`. The
 * players chosen or shown are the other players (with `self`, the waking player too), only
 * ones who register as alive with `alive`.
 *
 * The official names below that are such an answer are presets that expand to it (`PRESETS`);
 * the two left are worked out one by one, each for a single character:
 * - `demon-in-pair`: two players, one of them the Demon; with more than one Demon, the one
 *   whose kill this player's death is recorded as (Sage);
 * - `type-differs-from-token`: one player whose character type differs from that of the
 *   player carrying `token`, the last one shown (Balloonist).
 * `reminders` are the tokens to place: `target` on the shown character's player, `other` on the
 * second player, `each` on every player tapped.
 */
const LEARNS_BLOCKS = [
	'count',
	'players',
	'any-of',
	'character',
	'same',
	'alignment',
	'direction',
	'distance',
	'storyteller'
] as const;
const LEARNS_MEASURES = [
	...LEARNS_BLOCKS,
	'pair-of-type',
	'evil-pairs',
	'evil-alive-neighbours',
	'demon-minion-steps',
	'demon-or-token',
	'good-player',
	'one-evil-of-three',
	'same-alignment',
	'demon-in-pair',
	'character-of',
	'not-demon-pair',
	'evil-player',
	'demon-player',
	'closest-evil-direction',
	'chosen-alignment',
	'type-differs-from-token',
	'woke-tonight',
	'storyteller-pick'
] as const;
const LEARNS_SCOPES = ['alive-neighbours', 'neighbour-pairs', 'everyone'] as const;
type LearnsMeasure = (typeof LEARNS_MEASURES)[number];
/** A building block. */
export type LearnsBlock = (typeof LEARNS_BLOCKS)[number];
export const isLearnsBlock = (measure: LearnsMeasure): measure is LearnsBlock =>
	(LEARNS_BLOCKS as readonly string[]).includes(measure);
/** The blocks that need who matches. */
const MATCHING_BLOCKS: readonly LearnsBlock[] = [
	'count',
	'players',
	'any-of',
	'direction',
	'distance'
];
/** The blocks with no players chosen. */
const UNCHOSEN_BLOCKS: readonly LearnsBlock[] = ['count', 'direction', 'distance'];

/** The official names that are a building block, and the block each expands to. */
const PRESETS: Partial<Record<LearnsMeasure, Omit<Learns, 'preset'>>> = {
	'evil-alive-neighbours': { measure: 'count', scope: 'alive-neighbours', alignment: 'evil' },
	'evil-pairs': { measure: 'count', scope: 'neighbour-pairs', alignment: 'evil' },
	'woke-tonight': { measure: 'count', choose: 2, alive: true, woke: true },
	'good-player': { measure: 'players', choose: 1, alignment: 'good' },
	'evil-player': { measure: 'players', choose: 1, alignment: 'evil' },
	'demon-player': { measure: 'players', choose: 1, types: ['demon'] },
	'one-evil-of-three': { measure: 'players', choose: 3, matching: 1, alignment: 'evil' },
	'not-demon-pair': { measure: 'players', choose: 2, matching: 0, types: ['demon'] },
	'demon-or-token': { measure: 'any-of', choose: 2, self: true, types: ['demon'] },
	'character-of': { measure: 'character', choose: 1 },
	'pair-of-type': { measure: 'character', choose: 2 },
	'same-alignment': { measure: 'same', choose: 2 },
	'chosen-alignment': { measure: 'alignment', choose: 1, self: true },
	'closest-evil-direction': { measure: 'direction', alignment: 'evil' },
	'demon-minion-steps': { measure: 'distance', types: ['demon'], to: ['minion'] },
	'storyteller-pick': { measure: 'storyteller', choose: 1 }
};

export interface Learns {
	measure: LearnsMeasure;
	/** The official name this block was written as (`PRESETS`). */
	preset?: LearnsMeasure;
	/** For a block: where it looks; everyone when left out. */
	scope?: (typeof LEARNS_SCOPES)[number];
	/** For a block: how many players are chosen or shown. */
	choose?: number;
	/** For `players`: how many of them match; all when left out. */
	matching?: number;
	/** For a block: only players who woke tonight by their own ability match. */
	woke?: true;
	/** For `distance`: the character types it counts the steps to. */
	to?: readonly CharacterType[];
	token?: ReminderLabel;
	noneWhenAbsent?: boolean;
	/** For a block: the waking player may be the one (the Ravenkeeper "any player"). */
	self?: true;
	/** For a block: only alive players (the King's "alive character"). */
	alive?: true;
	/** For a block: who matches. */
	types?: readonly CharacterType[];
	alignment?: Alignment;
	reminders?: { target?: ReminderLabel; other?: ReminderLabel; each?: ReminderLabel };
}

/**
 * What an `answers` character learns, each worked out in `rules/night-info.ts`:
 * `minion-nominated` (Town Crier), `demon-voted` (Flowergirl), `executed-character`
 * (Undertaker), `outsider-died` (Godfather), `correct-guesses` (Juggler), `statement-true`
 * (Gossip, from the statement logged by day, L58), `outsiders-in-play` (the Outsider characters
 * in play), `winning-alignment` (General: which team the Storyteller believes is winning, good,
 * evil or neither, their judgement, so all three are offered).
 * `count` is the building block (M77): how many players of a group match, the group `among`:
 * - `dead`: those who register as dead;
 * - `marked`: those carrying this character's reminders, the waking player included;
 * - `abnormal`: those whose ability worked abnormally since dawn because of another
 *   character, from the info recorded as abnormal; once the Storyteller has put this
 *   character's `token` on players, those carrying it (their call).
 * A player matches when they register as `alignment`, every one of the group when left out.
 * The official names below that are such a count are presets that expand to it
 * (`ANSWER_PRESETS`): `evil-dead` (Oracle), `evil-marked` (the Duchess's visitors) and
 * `abnormal-abilities` (Mathematician).
 * `token` is the character's reminder that marks the answer on the board ("Died Today",
 * "Abnormal"). `firstNight` is the question asked on the first night instead, for a
 * character that learns something else then (the Godfather starts knowing which Outsiders
 * are in play, https://wiki.bloodontheclocktower.com/Godfather).
 * `wakes: 'marked'` wakes each player carrying one of this character's reminders, for a
 * character no player holds (a Fabled: https://wiki.bloodontheclocktower.com/Duchess).
 * `falseToken` is the reminder whose player must get false information (the Duchess's
 * "False Info").
 */
const ANSWER_QUESTIONS = [
	'minion-nominated',
	'demon-voted',
	'executed-character',
	'outsider-died',
	'correct-guesses',
	'statement-true',
	'outsiders-in-play',
	'winning-alignment',
	'count'
] as const;
const ANSWER_PRESET_NAMES = ['evil-dead', 'evil-marked', 'abnormal-abilities'] as const;
const ANSWER_NAMES = [...ANSWER_QUESTIONS, ...ANSWER_PRESET_NAMES] as const;
const COUNT_AMONG = ['dead', 'marked', 'abnormal'] as const;
const ANSWER_WAKES = ['marked'] as const;
type AnswerQuestion = (typeof ANSWER_QUESTIONS)[number];
type AnswerPreset = (typeof ANSWER_PRESET_NAMES)[number];

/** A `count` answer: how many players of a group match. */
export interface AnswerCount {
	among: (typeof COUNT_AMONG)[number];
	alignment?: Alignment;
}

/** The official names that are a `count`, and the count each expands to. */
const ANSWER_PRESETS: Readonly<Record<AnswerPreset, AnswerCount>> = {
	'evil-dead': { among: 'dead', alignment: 'evil' },
	'evil-marked': { among: 'marked', alignment: 'evil' },
	'abnormal-abilities': { among: 'abnormal' }
};

/** A question as asked: one worked out on its own, or a `count`. */
export type AnswerAsked =
	| { question: Exclude<AnswerQuestion, 'count'> }
	| ({ question: 'count'; preset?: AnswerPreset } & AnswerCount);

export type Answers = AnswerAsked & {
	token?: ReminderLabel;
	firstNight?: AnswerAsked;
	wakes?: (typeof ANSWER_WAKES)[number];
	falseToken?: ReminderLabel;
};

/** `name` as asked: a preset expanded to its `count`. */
function asked(name: (typeof ANSWER_NAMES)[number], count?: AnswerCount): AnswerAsked {
	if (name === 'count') return { question: 'count', ...(count as AnswerCount) };
	if (name in ANSWER_PRESETS) {
		const preset = name as AnswerPreset;
		return { question: 'count', ...ANSWER_PRESETS[preset], preset };
	}
	return { question: name as Exclude<AnswerQuestion, 'count'> };
}

export function readLearns(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Learns | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		[
			'measure',
			'type',
			'token',
			'noneWhenAbsent',
			'self',
			'alive',
			'types',
			'alignment',
			'reminders',
			'scope',
			'choose',
			'matching',
			'woke',
			'to'
		],
		path,
		issues
	);
	const measure = readEnum(raw, 'measure', LEARNS_MEASURES, path, issues, true);
	const scope = readEnum(raw, 'scope', LEARNS_SCOPES, path, issues, false);
	const choose = readCount(raw, 'choose', path, issues);
	const matching = readCount(raw, 'matching', path, issues);
	const woke = readBoolean(raw, 'woke', path, issues);
	const type = readEnum(raw, 'type', CHARACTER_TYPES, path, issues, false);
	const token = readToken(raw, 'token', path, issues, reminders);
	const noneWhenAbsent = readBoolean(raw, 'noneWhenAbsent', path, issues);
	const types = readTypes(raw, 'types', path, issues);
	const to = readTypes(raw, 'to', path, issues);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
	const self = readBoolean(raw, 'self', path, issues);
	const alive = readBoolean(raw, 'alive', path, issues);
	if (!measure) return undefined;
	if (measure === 'pair-of-type' && !type) issues.add(`${path}.type`, 'missing');
	if ((measure === 'demon-or-token' || measure === 'type-differs-from-token') && !token) {
		issues.add(`${path}.token`, 'missing');
	}
	const preset = PRESETS[measure];
	const block = preset?.measure ?? measure;
	const out: Learns = preset ? { ...preset, preset: measure } : { measure };
	if (token) out.token = token;
	if (noneWhenAbsent !== undefined) out.noneWhenAbsent = noneWhenAbsent;
	if (type) {
		if (measure !== 'pair-of-type') issues.add(`${path}.type`, 'only `pair-of-type` takes it');
		else out.types = [type];
	}
	if (types || alignment || self || alive) {
		if (!isLearnsBlock(block)) issues.add(path, 'only the building blocks take who it is about');
		if (self) out.self = true;
		if (alive) out.alive = true;
		if (types) out.types = types;
		if (alignment) out.alignment = alignment;
	}
	if (to) {
		if (block !== 'distance') issues.add(`${path}.to`, 'only `distance` takes it');
		else out.to = to;
	}
	if (scope || choose !== undefined || matching !== undefined || woke) {
		if (!isLearnsBlock(block)) issues.add(path, 'only the building blocks take a scope or count');
		if (scope) out.scope = scope;
		if (choose !== undefined) out.choose = choose;
		if (matching !== undefined) out.matching = matching;
		if (woke) out.woke = true;
	}
	if (isLearnsBlock(block)) checkBlock(out, path, issues);
	if (raw.reminders !== undefined) {
		const at = `${path}.reminders`;
		if (!isObject(raw.reminders)) {
			issues.add(at, `expected object, got ${describe(raw.reminders)}`);
		} else {
			checkKeys(raw.reminders, ['target', 'other', 'each'], at, issues);
			const placed: NonNullable<Learns['reminders']> = {};
			for (const key of ['target', 'other', 'each'] as const) {
				const label = readToken(raw.reminders, key, at, issues, reminders);
				if (label) placed[key] = label;
			}
			out.reminders = placed;
		}
	}
	return out;
}

/** A whole number of players, 1 or more. */
function readCount(
	raw: Record<string, unknown>,
	key: string,
	path: string,
	issues: Issues
): number | undefined {
	const n = readNumber(raw, key, path, issues);
	if (n === undefined) return undefined;
	if (!Number.isInteger(n) || n < 0) {
		issues.add(`${path}.${key}`, 'expected a whole number');
		return undefined;
	}
	return n;
}

/** What a building block needs to be worked out. */
function checkBlock(learns: Learns, path: string, issues: Issues) {
	const { measure, scope, choose, matching } = learns;
	const near = scope === 'alive-neighbours' || scope === 'neighbour-pairs';
	if (near && choose !== undefined) issues.add(`${path}.choose`, `not with scope \`${scope}\``);
	if (scope && measure !== 'count') issues.add(`${path}.scope`, 'only a `count` takes a scope');
	const unchosen = UNCHOSEN_BLOCKS.includes(measure as LearnsBlock);
	if (!unchosen && !choose) issues.add(`${path}.choose`, 'missing');
	if (unchosen && measure !== 'count' && choose !== undefined)
		issues.add(`${path}.choose`, `not with \`${measure}\``);
	if (measure === 'character' && choose !== undefined && choose > 2)
		issues.add(`${path}.choose`, 'a `character` shows 1 or 2 players');
	if (measure === 'same' && choose !== undefined && choose < 2)
		issues.add(`${path}.choose`, 'a `same` compares 2 or more players');
	if (measure === 'alignment' && choose !== undefined && choose > 1)
		issues.add(`${path}.choose`, 'an `alignment` is of 1 player');
	if (matching !== undefined && measure !== 'players')
		issues.add(`${path}.matching`, 'only `players` takes it');
	if (matching !== undefined && choose !== undefined && matching > choose)
		issues.add(`${path}.matching`, 'more than are shown');
	if (measure === 'distance' && !learns.to) issues.add(`${path}.to`, 'missing');
	const named = learns.alignment || learns.types || learns.woke || learns.token;
	if (!named && MATCHING_BLOCKS.includes(measure as LearnsBlock))
		issues.add(path, 'needs who matches: `alignment`, `types`, `woke` or `token`');
}

export function readAnswers(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Answers | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		['question', 'among', 'alignment', 'token', 'firstNight', 'wakes', 'falseToken'],
		path,
		issues
	);
	const question = readEnum(raw, 'question', ANSWER_NAMES, path, issues, true);
	const among = readEnum(raw, 'among', COUNT_AMONG, path, issues, false);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
	const token = readToken(raw, 'token', path, issues, reminders);
	const firstNight = readEnum(raw, 'firstNight', ANSWER_NAMES, path, issues, false);
	const wakes = readEnum(raw, 'wakes', ANSWER_WAKES, path, issues, false);
	const falseToken = readToken(raw, 'falseToken', path, issues, reminders);
	if (!question) return undefined;
	if (question === 'count') {
		if (!among) {
			issues.add(`${path}.among`, 'missing');
			return undefined;
		}
		if (among === 'abnormal' && alignment) {
			issues.add(`${path}.alignment`, 'not with `among: "abnormal"`');
			return undefined;
		}
	} else if (among || alignment) {
		issues.add(path, 'only a `count` takes `among` and `alignment`');
		return undefined;
	}
	if (firstNight === 'count') {
		issues.add(`${path}.firstNight`, 'a `count` needs its own fields: name a preset');
		return undefined;
	}
	return {
		...asked(question, among ? { among, ...(alignment ? { alignment } : {}) } : undefined),
		...(token ? { token } : {}),
		...(firstNight ? { firstNight: asked(firstNight) } : {}),
		...(wakes ? { wakes } : {}),
		...(falseToken ? { falseToken } : {})
	};
}
