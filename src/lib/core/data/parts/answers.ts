import { anyOf, B, obj, oneOf, opt, TOKEN } from '../field-spec.ts';
import { ALIGNMENTS, CHARACTER_TYPES, type Alignment, type CharacterType } from '../types.ts';
import type { Issues } from '../validate.ts';
import { DAY_MARKS, type DayMark } from './day-mark.ts';
import { presetTable } from '../presets.ts';
import { specPart, partWords } from './part.ts';
import type { ReminderLabel } from '../types.ts';

/**
 * What an `answers` character learns, worked out in `rules/night/info/answers.ts`.
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
export const ANSWER_NAMES = [...ANSWER_BLOCKS, ...ANSWER_OWN, ...ANSWER_PRESET_NAMES] as const;
export const ANSWER_GROUPS = [
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
const ANSWER_PRESETS = presetTable<AnswerPreset, unknown, AnswerAsked>({
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
});

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
	return ANSWER_PRESETS.expand(name, undefined);
}

/** A night answer worked out from the grimoire and today's log (the Town Crier). */
export const answers = partWords(
	specPart(
		'night',
		'Night answer',
		'A night answer worked out from the grimoire and today’s log.',
		obj({
			question: oneOf(ANSWER_NAMES),
			among: opt(oneOf(ANSWER_GROUPS)),
			alignment: opt(oneOf(ALIGNMENTS)),
			types: opt(anyOf(CHARACTER_TYPES)),
			mark: opt(oneOf(DAY_MARKS)),
			onlyYes: opt(B),
			choices: opt(anyOf(ANSWER_CHOICES)),
			token: opt(TOKEN),
			firstNight: opt(oneOf(ANSWER_NAMES)),
			wakes: opt(oneOf(ANSWER_WAKES)),
			falseToken: opt(TOKEN)
		}),
		(value, path, issues): Answers | undefined => {
			const { question, among, alignment, types, mark, choices, token, firstNight, wakes } = value;
			const onlyYes = value.onlyYes || undefined;
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
				issues.add(`${path}.choices`, 'missing');
				return undefined;
			}
			if (choices && question !== 'storyteller') {
				issues.add(`${path}.choices`, 'only `storyteller` takes it');
				return undefined;
			}
			if (choices && (choices.length < 2 || new Set(choices).size < choices.length)) {
				issues.add(`${path}.choices`, 'expected two or more of `good`, `evil` and `neither`');
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
				...(value.falseToken ? { falseToken: value.falseToken } : {})
			};
		}
	),
	{
		question: {
			label: 'What it learns',
			names: {
				count: 'How many of a group match',
				any: 'Whether any of a group match',
				character: 'The character of one in a group',
				characters: 'The characters in play of a type',
				statement: 'Whether today’s statement was true',
				storyteller: 'The Storyteller’s own call',
				'outsider-died': 'Whether an Outsider died today',
				'correct-guesses': 'How many guesses were right',
				'statement-true': 'Today’s statement was true',
				'winning-alignment': 'Which team is winning',
				'evil-dead': 'How many dead players are evil',
				'evil-marked': 'How many marked players are evil',
				'abnormal-abilities': 'How many abilities worked abnormally',
				'minion-nominated': 'Whether a Minion nominated today',
				'demon-voted': 'Whether the Demon voted today',
				'executed-character': 'The character executed today',
				'outsiders-in-play': 'The Outsiders in play'
			}
		},
		among: {
			label: 'Group',
			about: 'The players it looks at.',
			names: {
				dead: 'Dead players',
				marked: 'Players with its reminders',
				abnormal: 'Players whose ability worked abnormally',
				guessed: 'Today’s right guesses',
				nominators: 'Players who nominated today',
				voters: 'Players who voted today',
				executed: 'Player executed today',
				died: 'Players who died today',
				everyone: 'Everyone'
			}
		},
		alignment: {
			label: 'Only this alignment'
		},
		types: {
			label: 'Only these character types'
		},
		mark: {
			label: 'Answered by the day mark',
			about: 'The Storyteller’s mark from the day, used when set.',
			names: {
				'demon-voted': 'Demon voted',
				'minion-nominated': 'Minion nominated'
			}
		},
		onlyYes: {
			label: 'Only a yes',
			about: 'A no is nothing to learn.'
		},
		choices: {
			label: 'Answers offered',
			names: {
				neither: 'Neither'
			}
		},
		token: {
			label: 'Answer reminder',
			about: 'Its reminder that marks the answer on the board.'
		},
		firstNight: {
			label: 'On the first night instead',
			about: 'What it learns on the first night, when that differs.'
		},
		wakes: {
			label: 'Wakes',
			names: {
				marked: 'Each player with its reminders'
			}
		},
		falseToken: {
			label: 'False info reminder',
			about: 'Its reminder on the player who gets false information.'
		}
	}
);

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
