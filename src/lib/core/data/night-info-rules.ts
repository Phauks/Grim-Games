/**
 * The `learns` and `answers` parts of a character's rules block: what its night information
 * is, worked out in `rules/night-info.ts`.
 */
import { readTypes } from './target-rules.ts';
import { readToken } from './reminder-fields.ts';
import { DAY_MARKS, type DayMark } from './parts/day-mark.ts';
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
	'storyteller-pick': { measure: 'storyteller', choose: 1 },
	'demon-in-pair': {
		measure: 'players',
		choose: 2,
		matching: 1,
		atLeast: true,
		types: ['demon'],
		killer: true
	},
	'type-differs-from-token': { measure: 'players', choose: 1 }
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
	/** For `players`: at least `matching` of them match (the Sage's pair may be two Demons). */
	atLeast?: true;
	/**
	 * For a block: only players whose character the waking player's death is recorded as, when
	 * any match (the Demon that killed the Sage, with more than one in play).
	 */
	killer?: true;
	/**
	 * For a block: players whose type differs from those of the players last shown, who carry
	 * this reminder (the Balloonist's "Seen").
	 */
	differsFromToken?: ReminderLabel;
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
 * What an `answers` character learns, worked out in `rules/night-info/answers.ts`.
 *
 * The building blocks (M77, M78) look at a group of players, the group `among`:
 * - `dead`: those who register as dead;
 * - `marked`: those carrying this character's reminders, the waking player included;
 * - `abnormal` (for `count` only): those whose ability worked abnormally since dawn because of
 *   another character, from the info recorded as abnormal; once the Storyteller has put this
 *   character's `token` on players, those carrying it (their call);
 * - `guessed` (for `count` only): today's guesses in this character's day claim, each one
 *   player and one character, that are right; once the Storyteller has put this character's
 *   `token` on players, how many tokens there are (their call);
 * - `nominators`: those who nominated today, from the nominations recorded;
 * - `voters`: those who voted today, which the app does not record, so only `mark` answers;
 * - `executed`: those who died by execution today, from the day log, else the dead player
 *   carrying this character's `token`;
 * - `died`: those who died today, from the log, today's executions and exiles, and dead
 *   players carrying this character's `token`;
 * - `everyone`: every player.
 * A player matches when they register as `alignment` and as one of `types`, every one of the
 * group when neither is given. What is learnt about the group:
 * - `count`: how many match;
 * - `any`: yes when any matches. `mark` is the Storyteller's day mark (`parts/day-mark.ts`)
 *   that answers it when set and the group recorded today says otherwise, or says nothing.
 *   With `onlyYes`, a no is nothing to learn (the Godfather only wakes when one died);
 * - `character`: the character of the latest player in the group who matches;
 * - `characters`: the characters in play of the one character type in `types`.
 * Two blocks look at no group:
 * - `statement`: whether today's statement in this character's day claim was true, the
 *   Storyteller's mark on it (L58);
 * - `storyteller`: the Storyteller's own judgement, one of `choices` (alignments, or
 *   `neither`), all offered.
 * The official names below are presets that expand to a block (`ANSWER_PRESETS`):
 * `evil-dead` (Oracle), `evil-marked` (the Duchess's visitors), `abnormal-abilities`
 * (Mathematician), `minion-nominated` (Town Crier), `demon-voted` (Flowergirl),
 * `executed-character` (Undertaker), `outsiders-in-play` (Godfather, first night),
 * `outsider-died` (Godfather), `correct-guesses` (Juggler), `statement-true` (Gossip) and
 * `winning-alignment` (General: which team is winning, good, evil or neither).
 * `token` is the character's reminder that marks the answer on the board ("Died Today",
 * "Abnormal"). `firstNight` is the question asked on the first night instead, for a
 * character that learns something else then (the Godfather starts knowing which Outsiders
 * are in play, https://wiki.bloodontheclocktower.com/Godfather).
 * `wakes: 'marked'` wakes each player carrying one of this character's reminders, for a
 * character no player holds (a Fabled: https://wiki.bloodontheclocktower.com/Duchess).
 * `falseToken` is the reminder whose player must get false information (the Duchess's
 * "False Info").
 */
/** The blocks that look at a group (`among`). */
const ANSWER_BLOCKS = ['count', 'any', 'character', 'characters'] as const;
/** The blocks that look at no group. */
const ANSWER_OWN = ['statement', 'storyteller'] as const;
const ANSWER_PRESET_NAMES = [
	'outsider-died',
	'correct-guesses',
	'statement-true',
	'winning-alignment',
	'evil-dead',
	'evil-marked',
	'abnormal-abilities',
	'minion-nominated',
	'demon-voted',
	'executed-character',
	'outsiders-in-play'
] as const;
const ANSWER_NAMES = [...ANSWER_BLOCKS, ...ANSWER_OWN, ...ANSWER_PRESET_NAMES] as const;
const ANSWER_GROUPS = [
	'dead',
	'marked',
	'abnormal',
	'guessed',
	'nominators',
	'voters',
	'executed',
	'died',
	'everyone'
] as const;
const ANSWER_WAKES = ['marked'] as const;
type AnswerBlock = (typeof ANSWER_BLOCKS)[number];
/** What a `storyteller` block may answer. */
export const ANSWER_CHOICES = ['good', 'evil', 'neither'] as const;
export type AnswerChoice = (typeof ANSWER_CHOICES)[number];
type AnswerPreset = (typeof ANSWER_PRESET_NAMES)[number];

/** The group a building block looks at, and who in it matches. */
export interface AnswerGroup {
	among: (typeof ANSWER_GROUPS)[number];
	alignment?: Alignment;
	types?: readonly CharacterType[];
	/** For `any`: the Storyteller's day mark that answers it. */
	mark?: DayMark;
	/** For `any`: a no is nothing to learn. */
	onlyYes?: true;
}

/** The official names that are a block, and the block each expands to. */
const ANSWER_PRESETS: Readonly<Record<AnswerPreset, AnswerAsked>> = {
	'evil-dead': { question: 'count', among: 'dead', alignment: 'evil' },
	'evil-marked': { question: 'count', among: 'marked', alignment: 'evil' },
	'abnormal-abilities': { question: 'count', among: 'abnormal' },
	'minion-nominated': {
		question: 'any',
		among: 'nominators',
		types: ['minion'],
		mark: 'minion-nominated'
	},
	'demon-voted': { question: 'any', among: 'voters', types: ['demon'], mark: 'demon-voted' },
	'executed-character': { question: 'character', among: 'executed' },
	'outsiders-in-play': { question: 'characters', among: 'everyone', types: ['outsider'] },
	'outsider-died': { question: 'any', among: 'died', types: ['outsider'], onlyYes: true },
	'correct-guesses': { question: 'count', among: 'guessed' },
	'statement-true': { question: 'statement' },
	'winning-alignment': { question: 'storyteller', choices: ['good', 'evil', 'neither'] }
};

/** A question as asked: a building block, with the official name it was written as. */
export type AnswerAsked = { preset?: AnswerPreset } & (
	| ({ question: AnswerBlock } & AnswerGroup)
	| { question: 'statement' }
	| { question: 'storyteller'; choices: readonly AnswerChoice[] }
);

export type Answers = AnswerAsked & {
	token?: ReminderLabel;
	firstNight?: AnswerAsked;
	wakes?: (typeof ANSWER_WAKES)[number];
	falseToken?: ReminderLabel;
};

const isAnswerBlock = (name: string): name is AnswerBlock =>
	(ANSWER_BLOCKS as readonly string[]).includes(name);

/** `name` as asked: a preset expanded to its block. */
function asked(
	name: (typeof ANSWER_NAMES)[number],
	group?: AnswerGroup,
	choices?: readonly AnswerChoice[]
): AnswerAsked {
	if (isAnswerBlock(name)) return { question: name, ...(group as AnswerGroup) };
	if (name === 'storyteller') return { question: name, choices: choices ?? [] };
	if (name === 'statement') return { question: name };
	return { ...ANSWER_PRESETS[name], preset: name };
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
			'to',
			'atLeast',
			'killer',
			'differsFromToken'
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
	const atLeast = readBoolean(raw, 'atLeast', path, issues);
	const killer = readBoolean(raw, 'killer', path, issues);
	const differsFromToken = readToken(raw, 'differsFromToken', path, issues, reminders);
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
	// The Balloonist's token marks who was shown, which the players shown now must differ from.
	if (token && measure === 'type-differs-from-token') out.differsFromToken = token;
	else if (token) out.token = token;
	if (differsFromToken) out.differsFromToken = differsFromToken;
	if (killer) out.killer = true;
	if (atLeast) {
		if (block !== 'players') issues.add(`${path}.atLeast`, 'only `players` takes it');
		else out.atLeast = true;
	}
	if (noneWhenAbsent !== undefined) out.noneWhenAbsent = noneWhenAbsent;
	if (type) {
		if (measure !== 'pair-of-type') issues.add(`${path}.type`, 'only `pair-of-type` takes it');
		else out.types = [type];
	}
	if (types || alignment || self || alive) {
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
	const named =
		learns.alignment || learns.types || learns.woke || learns.token || learns.differsFromToken;
	if (!named && MATCHING_BLOCKS.includes(measure as LearnsBlock))
		issues.add(
			path,
			'needs who matches: `alignment`, `types`, `woke`, `token` or `differsFromToken`'
		);
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
		[
			'question',
			'among',
			'alignment',
			'types',
			'mark',
			'onlyYes',
			'choices',
			'token',
			'firstNight',
			'wakes',
			'falseToken'
		],
		path,
		issues
	);
	const question = readEnum(raw, 'question', ANSWER_NAMES, path, issues, true);
	const among = readEnum(raw, 'among', ANSWER_GROUPS, path, issues, false);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
	const types = readTypes(raw, 'types', path, issues);
	const mark = readEnum(raw, 'mark', DAY_MARKS, path, issues, false);
	const onlyYes = readBoolean(raw, 'onlyYes', path, issues) === true || undefined;
	const choices = readChoices(raw, path, issues);
	const token = readToken(raw, 'token', path, issues, reminders);
	const firstNight = readEnum(raw, 'firstNight', ANSWER_NAMES, path, issues, false);
	const wakes = readEnum(raw, 'wakes', ANSWER_WAKES, path, issues, false);
	const falseToken = readToken(raw, 'falseToken', path, issues, reminders);
	if (!question) return undefined;
	let group: AnswerGroup | undefined;
	if (isAnswerBlock(question)) {
		if (!among) {
			issues.add(`${path}.among`, 'missing');
			return undefined;
		}
		group = {
			among,
			...(alignment ? { alignment } : {}),
			...(types ? { types } : {}),
			...(mark ? { mark } : {}),
			...(onlyYes ? { onlyYes } : {})
		};
		if (!checkAnswerBlock(question, group, path, issues)) return undefined;
	} else if (among || alignment || types || mark || onlyYes) {
		issues.add(
			path,
			'only a block that looks at a group takes `among`, `alignment`, `types`, `mark` and `onlyYes`'
		);
		return undefined;
	}
	if (question === 'storyteller' && !choices) {
		if (raw.choices === undefined) issues.add(`${path}.choices`, 'missing');
		return undefined;
	}
	if (choices && question !== 'storyteller') {
		issues.add(`${path}.choices`, 'only `storyteller` takes it');
		return undefined;
	}
	if (firstNight && (isAnswerBlock(firstNight) || firstNight === 'storyteller')) {
		issues.add(`${path}.firstNight`, `a \`${firstNight}\` needs its own fields: name a preset`);
		return undefined;
	}
	return {
		...asked(question, group, choices),
		...(token ? { token } : {}),
		...(firstNight ? { firstNight: asked(firstNight) } : {}),
		...(wakes ? { wakes } : {}),
		...(falseToken ? { falseToken } : {})
	};
}

/** A `storyteller` block's `choices`: some of good, evil and neither. */
function readChoices(
	raw: Record<string, unknown>,
	path: string,
	issues: Issues
): AnswerChoice[] | undefined {
	const value = raw.choices;
	if (value === undefined) return undefined;
	const ok =
		Array.isArray(value) &&
		value.length >= 2 &&
		value.every((v, i) => ANSWER_CHOICES.includes(v) && value.indexOf(v) === i);
	if (!ok) {
		issues.add(`${path}.choices`, 'expected two or more of `good`, `evil` and `neither`');
		return undefined;
	}
	return value as AnswerChoice[];
}

/** Whether a block's group fits what it asks. */
function checkAnswerBlock(
	question: AnswerBlock,
	group: AnswerGroup,
	path: string,
	issues: Issues
): boolean {
	const before = issues.list.length;
	if (group.among === 'abnormal' && question !== 'count')
		issues.add(`${path}.among`, 'only a `count` looks at `abnormal`');
	if (group.among === 'abnormal' && (group.alignment || group.types))
		issues.add(path, 'not with `among: "abnormal"`: it counts every one');
	if (group.among === 'guessed' && question !== 'count')
		issues.add(`${path}.among`, 'only a `count` looks at `guessed`');
	if (group.among === 'guessed' && (group.alignment || group.types))
		issues.add(path, 'not with `among: "guessed"`: it counts the right guesses');
	if (group.onlyYes && question !== 'any') issues.add(`${path}.onlyYes`, 'only `any` takes it');
	if (group.among === 'voters' && !group.mark)
		issues.add(`${path}.mark`, 'votes are not recorded: `voters` needs a `mark`');
	if (group.mark && question !== 'any') issues.add(`${path}.mark`, 'only `any` takes it');
	if (question === 'characters' && group.types?.length !== 1)
		issues.add(`${path}.types`, 'a `characters` shows one character type');
	return issues.list.length === before;
}
