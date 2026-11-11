/**
 * The Character builder's fields for each rule with several settings (M62): the shape of its
 * value as written in a rules block, read from the rule's own reader in `parts/`. A simple rule
 * (on, a choice, a number, a reminder) has its field on the part itself (`parts/part.ts`).
 * `rule-fields.test.ts` reads every official character's rules through these, so a setting an
 * official character uses is never missing; the night position and night text are edited in
 * the builder's Night section instead.
 */
import {
	anyOf,
	B,
	byToken,
	COUNT,
	list,
	NUM,
	obj,
	oneOf,
	opt,
	optObj,
	STR,
	STRS,
	T,
	TOKEN,
	TOKENS,
	variants,
	type FieldSpec
} from './field-spec.ts';
import { ALIGNMENTS, CHARACTER_TYPES } from './types.ts';
import { JINX_FIELDS } from './jinx-fields.ts';
import type * as PARTS from './parts/index.ts';

const TYPES = oneOf(CHARACTER_TYPES);
const SOME_TYPES = anyOf(CHARACTER_TYPES);
const ALIGNMENT = oneOf(ALIGNMENTS);
const DAY_GROUPS = oneOf([
	'madness',
	'day-ability',
	'nomination',
	'vote',
	'execution-death',
	'announcement'
]);
const ANSWER_NAMES = [
	'count',
	'any',
	'character',
	'characters',
	'statement',
	'storyteller',
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
];
const ASKED = {
	question: oneOf(ANSWER_NAMES),
	among: opt(
		oneOf([
			'dead',
			'marked',
			'abnormal',
			'guessed',
			'nominators',
			'voters',
			'executed',
			'died',
			'everyone'
		])
	),
	alignment: opt(ALIGNMENT),
	types: opt(SOME_TYPES),
	mark: opt(oneOf(['minion-nominated', 'demon-voted'])),
	onlyYes: opt(T),
	choices: opt(anyOf(['good', 'evil', 'neither']))
};
/** Each rule's fields, by its key in the rules block. */
export const RULE_FIELDS: Partial<Record<keyof typeof PARTS, FieldSpec>> = {
	answers: obj({
		...ASKED,
		token: opt(TOKEN),
		firstNight: opt(
			variants(
				{ label: 'A question', is: 'string', spec: oneOf(ANSWER_NAMES) },
				{ label: 'A count', is: 'object', spec: obj(ASKED) }
			)
		),
		wakes: opt(oneOf(['marked'])),
		falseToken: opt(TOKEN)
	}),
	dayReminders: obj({
		impairable: opt(T),
		reminders: opt(
			list(
				obj({
					group: DAY_GROUPS,
					template: list(
						variants(
							{ label: 'Its player', has: 'self', spec: obj({ self: T }) },
							{ label: 'Its target', has: 'target', spec: obj({ target: T }) },
							{ label: 'The nominee', has: 'nominee', spec: obj({ nominee: T }) },
							{ label: 'Text', has: 'text', spec: obj({ text: STR }) },
							{
								label: 'A value',
								has: 'value',
								spec: obj({ value: STR, placeholder: STR })
							}
						)
					),
					when: opt(
						optObj({
							self: oneOf(['alive', 'dead', 'any']),
							reminder: TOKEN,
							noReminder: TOKEN,
							cause: STRS,
							minAlive: NUM,
							targetAlive: B,
							nomineeChose: T,
							noWish: T,
							day: NUM
						})
					)
				})
			)
		),
		interactions: opt(
			list(obj({ other: STR, group: DAY_GROUPS, text: STR, otherNoReminder: opt(TOKEN) }))
		),
		none: opt(STR)
	}),
	gameEnd: obj({
		ends: opt(
			list(
				obj({
					kind: oneOf([
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
					]),
					event: opt(
						oneOf([
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
						])
					),
					subject: opt(oneOf(['self', 'marked', 'either'])),
					carries: opt(T),
					otherAlive: opt(T),
					nominatedBySelf: opt(T),
					whileAlive: opt(T),
					noExecution: opt(T),
					aliveTotal: opt(NUM),
					onDay: opt(NUM),
					executions: opt(NUM),
					aliveAtMost: opt(NUM),
					wins: opt(oneOf(['own', 'other', 'opposing'])),
					then: opt(oneOf(['extra-day'])),
					token: opt(TOKEN),
					winner: opt(ALIGNMENT),
					alive: opt(NUM),
					alignment: opt(ALIGNMENT),
					types: opt(SOME_TYPES),
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
					kind: oneOf(['condition', 'marked-alive', 'becomes-demon', 'death-passes']),
					then: opt(oneOf(['blocks-good', 'becomes-demon', 'demon-passes'])),
					whileAlive: opt(T),
					ownKill: opt(T),
					token: opt(TOKEN),
					aliveAtLeast: opt(NUM),
					to: opt(TYPES),
					spentToken: opt(TOKEN)
				})
			)
		),
		aliveWhileDead: opt(optObj({ untilToken: TOKEN, whileCarrierAlive: TOKEN })),
		invertWinner: opt(B),
		decidedByStoryteller: opt(B),
		joinsWinner: opt(B),
		alwaysWinsWith: opt(ALIGNMENT),
		contest: opt(obj({ chooser: TYPES, tie: ALIGNMENT }))
	}),
	jinxes: JINX_FIELDS,
	learns: obj({
		measure: oneOf([
			'count',
			'players',
			'any-of',
			'character',
			'same',
			'alignment',
			'direction',
			'distance',
			'storyteller',
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
		]),
		type: opt(TYPES),
		token: opt(TOKEN),
		noneWhenAbsent: opt(B),
		self: opt(T),
		alive: opt(T),
		types: opt(SOME_TYPES),
		alignment: opt(ALIGNMENT),
		reminders: opt(optObj({ target: TOKEN, other: TOKEN, each: TOKEN })),
		scope: opt(oneOf(['alive-neighbours', 'neighbour-pairs', 'everyone'])),
		choose: opt(COUNT),
		matching: opt(COUNT),
		woke: opt(T),
		to: opt(SOME_TYPES),
		atLeast: opt(T),
		killer: opt(T),
		differsFromToken: opt(TOKEN)
	}),
	marksChoice: TOKENS,
	nominationsAfterExecution: COUNT,
	reminderTargets: byToken(
		optObj({
			seat: oneOf(['self', 'other', 'any']),
			types: SOME_TYPES,
			shown: SOME_TYPES,
			characters: STRS,
			alignment: oneOf([...ALIGNMENTS, 'same', 'opposite']),
			sameAlignmentAs: STR,
			alignmentCounts: optObj({ good: NUM, evil: NUM }),
			maxPlaced: COUNT,
			life: oneOf(['alive', 'dead']),
			neighbour: obj({
				of: STR,
				ofType: opt(TYPES),
				type: opt(TYPES),
				alignment: opt(ALIGNMENT),
				alive: opt(B),
				both: opt(B)
			}),
			withLabel: STR,
			notWithLabel: STR,
			global: B,
			minOwners: COUNT,
			differsFromLastNight: oneOf(['player', 'type']),
			info: B,
			note: STR,
			ambiguous: STR
		})
	)
};
