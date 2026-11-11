import { anyOf, B, NUM, obj, oneOf, opt, optObj, TOKEN } from '../field-spec.ts';
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
	type CharacterType,
	type ReminderLabel
} from '../types.ts';
import type { Issues } from '../validate.ts';
import { presetTable } from '../presets.ts';
import { specPart } from './part.ts';

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
export const LEARNS_MEASURES = [
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
const PRESETS = presetTable<Exclude<LearnsMeasure, LearnsBlock>, unknown, Omit<Learns, 'preset'>>({
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
});

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

/** First-night information the Storyteller picks from the truthful options (the Chef). */
export const learns = specPart(
	'First-night information',
	'First-night information the Storyteller picks from the truthful options.',
	obj({
		measure: oneOf(LEARNS_MEASURES),
		type: opt(oneOf(CHARACTER_TYPES)),
		token: opt(TOKEN),
		noneWhenAbsent: opt(B),
		self: opt(B),
		alive: opt(B),
		types: opt(anyOf(CHARACTER_TYPES)),
		alignment: opt(oneOf(ALIGNMENTS)),
		reminders: opt(optObj({ target: TOKEN, other: TOKEN, each: TOKEN })),
		scope: opt(oneOf(LEARNS_SCOPES)),
		choose: opt(NUM),
		matching: opt(NUM),
		woke: opt(B),
		to: opt(anyOf(CHARACTER_TYPES)),
		atLeast: opt(B),
		killer: opt(B),
		differsFromToken: opt(TOKEN)
	}),
	(value, path, issues): Learns | undefined => {
		const before = issues.list.length;
		const { measure, type, token, types, alignment, scope, choose, matching, to } = value;
		if (measure === 'pair-of-type' && !type) issues.add(`${path}.type`, 'missing');
		if ((measure === 'demon-or-token' || measure === 'type-differs-from-token') && !token) {
			issues.add(`${path}.token`, 'missing');
		}
		const out: Learns = PRESETS.has(measure) ? PRESETS.expand(measure, value) : { measure };
		const block = out.measure;
		// The Balloonist's token marks who was shown, which the players shown now must differ from.
		if (token && measure === 'type-differs-from-token') out.differsFromToken = token;
		else if (token) out.token = token;
		if (value.differsFromToken) out.differsFromToken = value.differsFromToken;
		if (value.killer) out.killer = true;
		if (value.atLeast) {
			if (block !== 'players') issues.add(`${path}.atLeast`, 'only `players` takes it');
			else out.atLeast = true;
		}
		if (value.noneWhenAbsent !== undefined) out.noneWhenAbsent = value.noneWhenAbsent;
		if (type) {
			if (measure !== 'pair-of-type') issues.add(`${path}.type`, 'only `pair-of-type` takes it');
			else out.types = [type];
		}
		if (value.self) out.self = true;
		if (value.alive) out.alive = true;
		if (types) out.types = types;
		if (alignment) out.alignment = alignment;
		if (to) {
			if (block !== 'distance') issues.add(`${path}.to`, 'only `distance` takes it');
			else out.to = to;
		}
		if (scope) out.scope = scope;
		if (choose !== undefined) out.choose = choose;
		if (matching !== undefined) out.matching = matching;
		if (value.woke) out.woke = true;
		if (isLearnsBlock(block)) checkBlock(out, path, issues);
		if (value.reminders) out.reminders = value.reminders;
		return issues.list.length > before ? undefined : out;
	}
);

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
