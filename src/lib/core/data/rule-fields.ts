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
	byKey,
	byToken,
	COUNT,
	INT,
	list,
	NUM,
	NUMS,
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
import { ALIGNMENTS, CHARACTER_TYPES, SEATED_TYPES } from './types.ts';
import { DEATH_KINDS } from './death-cause-rules.ts';
import { INFO_CARDS } from './choice-rules.ts';
import { TURNS_PLAYERS } from './turns-players-rules.ts';
import { JINX_FIELDS } from './jinx-fields.ts';
import { PROTECTS_FROM } from './parts/protects.ts';
import { REMINDER_ENDS } from './parts/reminder-ends.ts';
import type * as PARTS from './parts/index.ts';

const TYPES = oneOf(CHARACTER_TYPES);
const SEATED = oneOf(SEATED_TYPES);
const SOME_TYPES = anyOf(CHARACTER_TYPES);
const SOME_SEATED = anyOf(SEATED_TYPES);
const ALIGNMENT = oneOf(ALIGNMENTS);
const IMPAIRMENTS = oneOf(['drunk', 'poisoned', 'no-ability']);
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
const INFO_TOKEN = obj({
	characters: STRS,
	upTo: opt(NUM),
	others: opt(oneOf(['opposite-alignment'])),
	shuffle: opt(T),
	order: opt(oneOf(['good-first'])),
	offer: opt(T),
	omit: opt(T),
	value: opt(STR),
	token: opt(STR),
	after: opt(STR)
});
const PLACEHOLDER_STEP = obj({
	tokens: list(obj({ label: TOKEN, action: oneOf(['place', 'remove']) })),
	either: opt(B)
});

/** Each rule's fields, by its key in the rules block. */
export const RULE_FIELDS: Partial<Record<keyof typeof PARTS, FieldSpec>> = {
	afterDeath: obj({ cause: STRS, nominations: opt(NUM), votes: opt(NUM) }),
	afterExecution: obj({
		of: opt(TYPES),
		alignment: opt(ALIGNMENT),
		token: TOKEN,
		on: opt(oneOf(['executed'])),
		moves: opt(T),
		marksSelf: opt(obj({ token: TOKEN, alignment: ALIGNMENT })),
		when: opt(oneOf(['day']))
	}),
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
	becomes: obj({
		token: TOKEN,
		into: oneOf(['demon', 'evil', 'swap', 'carrier-alignment']),
		when: opt(oneOf(['placed', 'removed'])),
		follows: opt(T),
		evenIfImpaired: opt(T),
		spent: opt(TOKEN)
	}),
	changesCharacter: obj({
		types: SOME_SEATED,
		notInPlay: opt(T),
		notTravellers: opt(T),
		alignment: opt(ALIGNMENT),
		token: opt(TOKEN),
		spent: opt(TOKEN),
		onlyFrom: opt(STRS),
		notMarked: opt(TOKEN),
		sameType: opt(T),
		anyType: opt(T),
		afterDeath: opt(T),
		firstNight: opt(T),
		upTo: opt(oneOf(['minions'])),
		extraMinions: opt(NUM),
		minMinions: opt(NUM),
		outward: opt(T)
	}),
	countdown: obj({ tokens: TOKENS }),
	counter: obj({ tokens: TOKENS, at: oneOf(['dawn', 'dusk']), replaces: opt(T) }),
	dayMark: obj({ mark: oneOf(['minion-nominated', 'demon-voted']), yes: TOKEN, no: TOKEN }),
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
	dayUse: optObj({
		who: oneOf(['chosen', 'nominator', 'nominee', 'nominated', 'guesser', 'guessed', 'ally']),
		vote: oneOf(['all-good-join']),
		kills: T,
		spentToken: TOKEN,
		answer: oneOf(['demon-if-marked']),
		anyone: T,
		minAlive: NUM,
		beforeNominations: T
	}),
	deadKeepAbilities: obj({ deadLose: SOME_SEATED, livingLose: SOME_SEATED }),
	deathCause: variants(
		{ label: 'None', has: 'none', spec: obj({ none: STR }) },
		{
			label: 'Causes a death',
			has: 'kind',
			spec: obj({
				kind: oneOf(DEATH_KINDS),
				onlyWith: opt(STRS),
				afterChanging: opt(SEATED),
				victim: opt(
					obj({
						who: oneOf(['self', 'not-self', 'alive-neighbour', 'registers']),
						as: opt(oneOf(['demon', 'not-demon', 'good', 'townsfolk'])),
						notSelf: opt(T)
					})
				)
			})
		}
	),
	deathCheck: obj({
		kind: oneOf(['wrong-guess', 'chose-impaired', 'chosen-good-dies', 'marked-killed-by-demon']),
		token: opt(TOKEN)
	}),
	demonAttack: optObj({ maySkip: T, mustSkipOnce: TOKEN, target: oneOf(['script-order']) }),
	evilInfo: obj({
		notes: opt(optObj({ minioninfo: STR, demoninfo: STR })),
		lateNote: opt(STR),
		wakeToken: opt(STR),
		hidesDemon: opt(T),
		anyPlayerCount: opt(T),
		hidesMinions: opt(T),
		shownAsOtherEvil: opt(T),
		whileWorking: opt(T),
		none: opt(T)
	}),
	execution: optObj({ insteadOf: oneOf(['same-alignment']), explodes: NUM }),
	executionOutcome: optObj({
		failsIf: oneOf(['only-evil-voted']),
		force: oneOf(['pass-or-fail']),
		executeNow: oneOf(['good-voted'])
	}),
	falseInfo: optObj({ types: SOME_TYPES, may: T, alignment: ALIGNMENT, spentToken: TOKEN }),
	gainedFrom: obj({
		token: TOKEN,
		pending: opt(TOKEN),
		swapped: opt(T),
		wakes: opt(T),
		ifEvil: opt(TOKEN),
		choose: opt(SOME_SEATED)
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
	givesAbility: obj({
		to: oneOf(['demon', 'storyteller', 'self']),
		types: SOME_SEATED,
		notInPlay: opt(T),
		onScript: opt(T),
		token: opt(TOKEN),
		whileWorks: opt(T),
		setup: opt(T),
		standIns: opt(TOKENS)
	}),
	impairs: optObj({
		self: obj({ reason: IMPAIRMENTS, aliveAtMost: opt(NUM) }),
		tokens: byToken(
			obj({
				reason: IMPAIRMENTS,
				on: oneOf(['carrier', 'others']),
				type: opt(TYPES),
				whileWorks: opt(B),
				whileKept: opt(obj({ token: TOKEN, nearest: opt(TYPES) }))
			})
		),
		clears: TOKENS,
		truthful: TOKENS
	}),
	infoCard: oneOf(INFO_CARDS),
	infoKind: optObj({ number: T, oncePerGame: T }),
	infoTokenCharacters: byKey(
		variants(
			{ label: 'One step', is: 'object', spec: INFO_TOKEN },
			{ label: 'Several steps', is: 'array', spec: list(INFO_TOKEN) }
		)
	),
	jinxes: JINX_FIELDS,
	keepsAbility: obj({ token: TOKEN, type: opt(TYPES) }),
	kills: obj({
		by: oneOf(['demon', 'other']),
		targets: opt(oneOf(['any', 'self'])),
		ignoresProtection: opt(B),
		count: opt(COUNT),
		charged: opt(obj({ token: TOKEN, count: COUNT })),
		delayed: opt(TOKEN),
		chooses: opt(oneOf(['character', 'live-or-die']))
	}),
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
	madAs: obj({
		token: TOKEN,
		mad: oneOf(['self', 'carrier']),
		choose: opt(SOME_SEATED),
		characters: opt(STRS)
	}),
	madness: obj({
		token: opt(TOKEN),
		breaking: oneOf(['execution', 'death']),
		alsoDies: opt(TOKEN),
		chosenBy: opt(oneOf(['nominee']))
	}),
	marksChoice: TOKENS,
	nightWakes: list(
		obj({
			when: oneOf(['each-night', 'each-night-except-first', 'one-night']),
			night: opt(COUNT),
			characters: opt(STRS),
			types: opt(SOME_SEATED),
			dead: opt(T),
			minutes: opt(COUNT)
		})
	),
	nominating: variants(
		{ label: 'Only the Storyteller', has: 'by', spec: obj({ by: oneOf(['storyteller']) }) },
		{ label: 'Times a game', has: 'perGame', spec: obj({ perGame: COUNT }) }
	),
	nominationsAfterExecution: COUNT,
	onDeath: obj({
		by: oneOf(['demon', 'other', 'any']),
		night: opt(T),
		places: opt(TOKEN),
		placesOn: opt(oneOf(['chosen']))
	}),
	onNominated: obj({
		by: opt(TYPES),
		carrier: opt(TOKEN),
		effect: oneOf(['execute-nominator', 'may-kill-nominator', 'evil-swap', 'nominator-may-die']),
		first: opt(T),
		minAlive: opt(NUM)
	}),
	pickedEffect: obj({
		token: TOKEN,
		effects: anyOf([
			'other',
			'poisoned',
			'mad',
			'dies',
			'no-kill',
			'no-vote-today',
			'no-ability-today'
		])
	}),
	protects: obj({
		who: oneOf(['self', 'marked', 'good']),
		token: opt(TOKEN),
		from: oneOf(PROTECTS_FROM),
		night: opt(T),
		storytellerDecides: opt(T),
		whileNeighboursGood: opt(T),
		whileCarrierAlive: opt(TOKEN)
	}),
	registersAs: optObj({
		self: optObj({ alignments: anyOf(ALIGNMENTS), types: SOME_TYPES }),
		tokens: byToken(
			optObj({
				alignments: anyOf(ALIGNMENTS),
				types: SOME_TYPES,
				carrierAlignment: ALIGNMENT,
				asAnything: T,
				whileToken: TOKEN
			})
		)
	}),
	reincarnates: obj({ first: COUNT, demonTo: opt(SEATED) }),
	reminderEnds: byToken(
		variants(
			{ label: 'At a time', is: 'string', spec: oneOf(REMINDER_ENDS) },
			{ label: 'At a nomination', has: 'nominated', spec: obj({ nominated: ALIGNMENT }) }
		)
	),
	reminderMovement: optObj({ fixed: TOKENS, why: STR, relocates: STR, followsNeighbours: TOKENS }),
	reminderPlaceholders: optObj({
		first: list(PLACEHOLDER_STEP),
		other: list(PLACEHOLDER_STEP),
		note: STR
	}),
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
	),
	setupModifier: obj({
		summary: STR,
		ops: list(
			obj({
				kind: oneOf(['delta', 'set', 'any']),
				type: SEATED,
				values: opt(
					variants(
						{ label: 'Numbers', is: 'array', spec: NUMS },
						{ label: 'Most', is: 'string', spec: oneOf(['most']) }
					)
				),
				also: opt(NUMS),
				minUsual: opt(NUM)
			})
		),
		requires: opt(STR),
		alignments: opt(list(obj({ type: SEATED, alignment: ALIGNMENT, count: COUNT }))),
		copies: opt(NUMS),
		duplicates: opt(anyOf(ALIGNMENTS)),
		notes: opt(STRS),
		readsBrackets: opt(T)
	}),
	setupPrep: optObj({
		reminders: list(
			obj({
				label: TOKEN,
				text: STR,
				target: variants(
					{ label: 'Its player', has: 'self', spec: obj({ self: T }) },
					{
						label: 'A chosen player',
						has: 'choose',
						spec: obj({
							choose: oneOf([
								'demon',
								'townsfolk',
								'outsider',
								'minion',
								'good',
								'evil',
								'any',
								'not-demon',
								'same-alignment',
								'copies',
								'nearest-townsfolk-anticlockwise',
								'nearest-townsfolk-clockwise'
							]),
							choice: STR,
							notSelf: opt(B)
						})
					}
				),
				reason: STR,
				timing: opt(oneOf(['setup', 'first-day'])),
				when: opt(optObj({ minOutsiders: NUM, exactOutsiders: NUM, minCopies: NUM })),
				first: opt(T)
			})
		),
		notes: list(
			obj({
				text: STR,
				tokens: opt(TOKENS),
				value: opt(obj({ key: STR, label: STR, character: opt(oneOf(['good'])) }))
			})
		),
		none: STR
	}),
	stopsKilling: obj({ token: TOKEN, type: opt(TYPES) }),
	stopsWaking: obj({ token: TOKEN, type: opt(TYPES) }),
	swapsCharacters: optObj({ notTypes: SOME_SEATED, chooser: SEATED }),
	swapsForAbility: obj({ token: TOKEN, good: SOME_SEATED, evil: SOME_SEATED }),
	tokenFlow: obj({ tokens: TOKENS }),
	turnsPlayersInto: obj({ type: SEATED, players: oneOf(TURNS_PLAYERS) }),
	voteWeight: variants(
		{ label: 'Its reminder', has: 'reminder', spec: obj({ reminder: TOKEN, weight: INT }) },
		{ label: 'Its player', has: 'self', spec: obj({ self: T, weight: INT }) }
	),
	voter: optObj({ onlyWith: TOKEN, must: T, minAlive: NUM, needsToken: T, learnsGiver: T }),
	voting: optObj({
		voters: oneOf(['self-and-dead']),
		deadNeedNoToken: T,
		noMajority: T,
		secret: T,
		deadRegainToken: oneOf(['final-day'])
	}),
	wakesWhen: optObj({
		deadAtLeastLiving: T,
		deadAtLeast: COUNT,
		diedTonight: obj({ characters: STRS, by: opt(oneOf(['demon'])) }),
		diedToday: obj({ types: SOME_TYPES, token: opt(TOKEN) }),
		nobodyDiedToday: T,
		untilToken: TOKEN,
		noneMarked: TOKEN,
		markedDied: TOKEN,
		nightAfterDay: COUNT,
		becameToday: T
	})
};
