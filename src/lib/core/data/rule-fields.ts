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
	COUNT,
	list,
	NUM,
	obj,
	oneOf,
	opt,
	optObj,
	T,
	TOKEN,
	type FieldSpec
} from './field-spec.ts';
import { ALIGNMENTS, CHARACTER_TYPES } from './types.ts';
import type * as PARTS from './parts/index.ts';

const TYPES = oneOf(CHARACTER_TYPES);
const SOME_TYPES = anyOf(CHARACTER_TYPES);
const ALIGNMENT = oneOf(ALIGNMENTS);
/** Each rule's fields, by its key in the rules block. */
export const RULE_FIELDS: Partial<Record<keyof typeof PARTS, FieldSpec>> = {
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
	nominationsAfterExecution: COUNT
};
