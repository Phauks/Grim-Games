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
 * The building blocks (M60): an answer over a group of players.
 * - `count`: how many players match, among the waking player's alive neighbours
 *   (`scope: 'alive-neighbours'`), the pairs of neighbours who both match
 *   (`'neighbour-pairs'`), everyone, or each `choose` players chosen;
 * - `players`: `choose` players shown, `matching` of them matching (all when left out);
 * - `any-of`: yes when any of `choose` chosen players matches.
 * A player matches when they register as every one of `alignment`, `types` and `woke`
 * (woke tonight by their own ability) that is given, or carry this character's `token`. The
 * players chosen or shown are the other players (with `self`, the waking player too), only
 * alive ones with `alive`.
 *
 * The official names below that are such an answer are presets that expand to it (`PRESETS`);
 * the rest are worked out one by one.
 *
 * What a `learns` character is shown, each worked out in `rules/night-info.ts`:
 * - `pair-of-type`: two players, one of them a `type` character, shown which (Washerwoman);
 *   `noneWhenAbsent` lets it learn there are none (Librarian);
 * - `evil-pairs`: pairs of evil neighbours (Chef);
 * - `evil-alive-neighbours`: evil among the two alive neighbours (Empath);
 * - `demon-minion-steps`: steps from the Demon to its nearest Minion (Clockmaker);
 * - `demon-or-token`: yes if either of two chosen players is the Demon or carries `token`
 *   (Fortune Teller's Red Herring);
 * - `good-player`: one good player (Steward);
 * - `one-evil-of-three`: three players, exactly one evil (Noble);
 * - `same-alignment`: yes if two chosen players are the same alignment (Seamstress);
 * - `demon-in-pair`: two players, one of them the Demon; with more than one Demon, the one
 *   whose kill this player's death is recorded as (Sage);
 * - `character-of`: one player's character (Ravenkeeper, King, Pixie, Grandmother), from the
 *   other players unless `self`, only `alive` ones, of `types` and `alignment` when given;
 * - `not-demon-pair`: two players, neither the Demon (Knight);
 * - `evil-player`: one evil player (Bounty Hunter);
 * - `demon-player`: the Demon's player (Choirboy);
 * - `closest-evil-direction`: whether the closest evil player sits clockwise or anticlockwise
 *   (Shugenja);
 * - `chosen-alignment`: the alignment of a player the waking player chose (Village Idiot);
 * - `type-differs-from-token`: one player whose character type differs from that of the
 *   player carrying `token`, the last one shown (Balloonist);
 * - `woke-tonight`: how many of two chosen alive players woke tonight by their own ability, a
 *   player woken to be asked counting even if they decline (Chambermaid);
 * - `storyteller-pick`: one other player, whoever the Storyteller judges best: any player is
 *   valid, so nothing is checked (High Priestess).
 * `reminders` are the tokens to place: `target` on the shown character's player, `other` on the
 * second player, `each` on every player tapped.
 */
const LEARNS_MEASURES = [
	'count',
	'players',
	'any-of',
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
/** A building block (`count`, `players`, `any-of`). */
export type LearnsBlock = 'count' | 'players' | 'any-of';
export const isLearnsBlock = (measure: LearnsMeasure): measure is LearnsBlock =>
	measure === 'count' || measure === 'players' || measure === 'any-of';

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
	'demon-or-token': { measure: 'any-of', choose: 2, self: true, types: ['demon'] }
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
	type?: CharacterType;
	token?: ReminderLabel;
	noneWhenAbsent?: boolean;
	/**
	 * For `character-of` or a block: the waking player may be the one (the Ravenkeeper "any
	 * player").
	 */
	self?: true;
	/** For `character-of` or a block: only alive players (the King's "alive character"). */
	alive?: true;
	/** For `character-of`, players of these types or this alignment; for a block, who matches. */
	types?: readonly CharacterType[];
	alignment?: Alignment;
	reminders?: { target?: ReminderLabel; other?: ReminderLabel; each?: ReminderLabel };
}

/**
 * What an `answers` character learns, each worked out in `rules/night-info.ts`:
 * `minion-nominated` (Town Crier), `demon-voted` (Flowergirl), `executed-character`
 * (Undertaker), `outsider-died` (Godfather), `correct-guesses` (Juggler), `evil-dead`
 * (Oracle), `abnormal-abilities` (Mathematician), `statement-true` (Gossip, from the
 * statement logged by day, L58), `outsiders-in-play` (the Outsider characters in play),
 * `winning-alignment` (General: which team the Storyteller believes is winning, good, evil or
 * neither, their judgement, so all three are offered).
 * `token` is the character's reminder that marks the answer on the board ("Died Today",
 * "Abnormal"). `firstNight` is the question asked on the first night instead, for a
 * character that learns something else then (the Godfather starts knowing which Outsiders
 * are in play, https://wiki.bloodontheclocktower.com/Godfather).
 * `evil-marked` counts the evil players among those carrying this character's reminders,
 * the waking player included (the Duchess's visitors).
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
	'evil-dead',
	'abnormal-abilities',
	'statement-true',
	'outsiders-in-play',
	'winning-alignment',
	'evil-marked'
] as const;
const ANSWER_WAKES = ['marked'] as const;
export interface Answers {
	question: (typeof ANSWER_QUESTIONS)[number];
	token?: ReminderLabel;
	firstNight?: (typeof ANSWER_QUESTIONS)[number];
	wakes?: (typeof ANSWER_WAKES)[number];
	falseToken?: ReminderLabel;
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
			'woke'
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
	if (type) out.type = type;
	if (token) out.token = token;
	if (noneWhenAbsent !== undefined) out.noneWhenAbsent = noneWhenAbsent;
	if (types || alignment || self || alive) {
		if (block !== 'character-of' && !isLearnsBlock(block))
			issues.add(path, 'only `character-of` and the building blocks take who it is about');
		if (self) out.self = true;
		if (alive) out.alive = true;
		if (types) out.types = types;
		if (alignment) out.alignment = alignment;
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
	if (near && measure !== 'count')
		issues.add(`${path}.scope`, 'only a `count` looks at neighbours');
	if (measure !== 'count' && !choose) issues.add(`${path}.choose`, 'missing');
	if (matching !== undefined && measure !== 'players')
		issues.add(`${path}.matching`, 'only `players` takes it');
	if (matching !== undefined && choose !== undefined && matching > choose)
		issues.add(`${path}.matching`, 'more than are shown');
	if (!learns.alignment && !learns.types && !learns.woke && !learns.token)
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
	checkKeys(raw, ['question', 'token', 'firstNight', 'wakes', 'falseToken'], path, issues);
	const question = readEnum(raw, 'question', ANSWER_QUESTIONS, path, issues, true);
	const token = readToken(raw, 'token', path, issues, reminders);
	const firstNight = readEnum(raw, 'firstNight', ANSWER_QUESTIONS, path, issues, false);
	const wakes = readEnum(raw, 'wakes', ANSWER_WAKES, path, issues, false);
	const falseToken = readToken(raw, 'falseToken', path, issues, reminders);
	if (!question) return undefined;
	return {
		question,
		...(token ? { token } : {}),
		...(firstNight ? { firstNight } : {}),
		...(wakes ? { wakes } : {}),
		...(falseToken ? { falseToken } : {})
	};
}
