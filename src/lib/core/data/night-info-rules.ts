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
import { checkKeys, describe, isObject, readBoolean, readEnum, type Issues } from './validate.ts';

/**
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
 * - `demon-in-pair`: two players, one of them the Demon (Sage);
 * - `character-of`: one player's character (Ravenkeeper, King, Pixie, Grandmother), from the
 *   other players unless `self`, only `alive` ones, of `types` and `alignment` when given;
 * - `not-demon-pair`: two players, neither the Demon (Knight);
 * - `evil-player`: one evil player (Bounty Hunter);
 * - `demon-player`: the Demon's player (Choirboy);
 * - `closest-evil-direction`: whether the closest evil player sits clockwise or anticlockwise
 *   (Shugenja);
 * - `chosen-alignment`: the alignment of a player the waking player chose (Village Idiot);
 * - `type-differs-from-token`: one player whose character type differs from that of the
 *   player carrying `token`, the last one shown (Balloonist).
 * `reminders` are the tokens to place: `target` on the shown character's player, `other` on the
 * second player, `each` on every player tapped.
 */
const LEARNS_MEASURES = [
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
	'type-differs-from-token'
] as const;
export interface Learns {
	measure: (typeof LEARNS_MEASURES)[number];
	type?: CharacterType;
	token?: ReminderLabel;
	noneWhenAbsent?: boolean;
	/** For `character-of`: the waking player may be the one (the Ravenkeeper "any player"). */
	self?: true;
	/** For `character-of`: only alive players (the King's "alive character"). */
	alive?: true;
	/** For `character-of`: only players of these types, or of this alignment. */
	types?: readonly CharacterType[];
	alignment?: Alignment;
	reminders?: { target?: ReminderLabel; other?: ReminderLabel; each?: ReminderLabel };
}

/**
 * What an `answers` character learns, each worked out in `rules/night-info.ts`:
 * `minion-nominated` (Town Crier), `demon-voted` (Flowergirl), `executed-character`
 * (Undertaker), `outsider-died` (Godfather), `correct-guesses` (Juggler), `evil-dead`
 * (Oracle), `abnormal-abilities` (Mathematician), `statement-true` (Gossip, from the
 * statement logged by day, L58), `outsiders-in-play` (the Outsider characters in play).
 * `token` is the character's reminder that marks the answer on the board ("Died Today",
 * "Abnormal"). `firstNight` is the question asked on the first night instead, for a
 * character that learns something else then (the Godfather starts knowing which Outsiders
 * are in play, https://wiki.bloodontheclocktower.com/Godfather).
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
	'outsiders-in-play'
] as const;
export interface Answers {
	question: (typeof ANSWER_QUESTIONS)[number];
	token?: ReminderLabel;
	firstNight?: (typeof ANSWER_QUESTIONS)[number];
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
			'reminders'
		],
		path,
		issues
	);
	const measure = readEnum(raw, 'measure', LEARNS_MEASURES, path, issues, true);
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
	const out: Learns = { measure };
	if (type) out.type = type;
	if (token) out.token = token;
	if (noneWhenAbsent !== undefined) out.noneWhenAbsent = noneWhenAbsent;
	if (types || alignment || self || alive) {
		if (measure !== 'character-of') issues.add(path, 'only `character-of` takes who it is about');
		if (self) out.self = true;
		if (alive) out.alive = true;
		if (types) out.types = types;
		if (alignment) out.alignment = alignment;
	}
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
	checkKeys(raw, ['question', 'token', 'firstNight'], path, issues);
	const question = readEnum(raw, 'question', ANSWER_QUESTIONS, path, issues, true);
	const token = readToken(raw, 'token', path, issues, reminders);
	const firstNight = readEnum(raw, 'firstNight', ANSWER_QUESTIONS, path, issues, false);
	if (!question) return undefined;
	return { question, ...(token ? { token } : {}), ...(firstNight ? { firstNight } : {}) };
}
