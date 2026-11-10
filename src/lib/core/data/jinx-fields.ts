/**
 * The Character builder's fields for a character's jinxes (M79): one entry per jinxed partner,
 * each with the effects the jinx has, drawn from the same verbs and conditions the jinx reader
 * takes (`jinx-read.ts`, `jinx-conditions.ts`). Each effect may be written the short way (`true`
 * for a verb with nothing to say, or its main value alone) or in full, with `who` and `when`;
 * the builder offers both, so an official file's jinxes open in fields as they are written.
 * `rule-fields.test.ts` reads every official jinx through these.
 */
import {
	anyOf,
	byCharacter,
	CHARACTER,
	COUNT,
	list,
	obj,
	oneOf,
	opt,
	someOf,
	STR,
	T,
	TEXT,
	TOKEN,
	variants,
	type FieldSpec,
	type Variant
} from './field-spec.ts';
import { JINX_FLAGS } from './jinx-conditions.ts';
import {
	ABNORMAL_COUNTS,
	CHOOSES_VIA,
	GAINED_ENDS,
	GIVEN_INSTEAD,
	GIVEN_WHERE,
	GRIMOIRE_HIDDEN,
	IMPAIR_KINDS,
	JINX_END_KINDS,
	JINX_WHO,
	LEARNS,
	NIGHT_CHOICE_CHOOSES,
	NIGHT_CHOICE_PARTNER,
	NO_EXECUTE_NOW_PLAYER,
	NO_KILL_TRIGGERS,
	NOT_SHOWN,
	STORYTELLER_CHOOSES,
	STORYTELLER_HAS
} from './jinx-rules.ts';
import { PROTECTS_FROM } from './parts/protects.ts';
import { ALIGNMENTS, CHARACTER_TYPES, SEATED_TYPES } from './types.ts';

const ALIGNMENT = oneOf(ALIGNMENTS);
const WHO = oneOf(JINX_WHO);

/**
 * A `when` condition: a plain one by name, or one keyed with its value. A `not` holds another
 * condition, so the description refers to itself.
 */
const CONDITION_VARIANTS: Variant[] = [
	{ label: 'Condition', is: 'string', spec: oneOf(JINX_FLAGS) },
	{ label: 'After day', has: 'afterDay', spec: obj({ afterDay: COUNT }) },
	{ label: 'Day', has: 'day', spec: obj({ day: COUNT }) },
	{ label: 'Night', has: 'night', spec: obj({ night: COUNT }) },
	// The partner's reminder on this character's player: not one of this character's own.
	{ label: 'Marked', has: 'marked', spec: obj({ marked: STR }) },
	{ label: 'Partner marked', has: 'partnerMarked', spec: obj({ partnerMarked: TOKEN }) },
	{ label: 'Alignment', has: 'alignment', spec: obj({ alignment: ALIGNMENT }) },
	{
		label: 'Partner alignment',
		has: 'partnerAlignment',
		spec: obj({ partnerAlignment: ALIGNMENT })
	},
	{ label: 'Alive', has: 'alive', spec: obj({ alive: CHARACTER }) },
	{ label: 'In play', has: 'inPlay', spec: obj({ inPlay: CHARACTER }) }
];
const CONDITION: FieldSpec = { kind: 'variants', variants: CONDITION_VARIANTS };
CONDITION_VARIANTS.push({ label: 'Not', has: 'not', spec: obj({ not: CONDITION }) });

/**
 * One verb: written in full, its own settings with `who` and `when`; written short, `true` (a
 * verb with no main setting) or its main setting's value alone.
 */
function verb(
	fields: Record<string, FieldSpec | ReturnType<typeof opt>> = {},
	main?: { key: string; spec: FieldSpec; is: 'string' | 'number' },
	who: FieldSpec = WHO
): FieldSpec {
	const full = obj({ ...fields, who: opt(who), when: opt(list(CONDITION)) });
	const short: Variant = main
		? { label: 'Short', is: main.is, spec: main.spec }
		: { label: 'On', is: 'true', spec: T };
	return variants(short, { label: 'With who and when', is: 'object', spec: full });
}

/** A verb whose one setting, `key`, is a choice and may be written alone. */
function choiceVerb(key: string, values: readonly string[]): FieldSpec {
	return verb({ [key]: oneOf(values) }, { key, spec: oneOf(values), is: 'string' });
}

/** Every effect a jinx may have, each optional; `exclusive` is about the pair alone. */
const JINX: FieldSpec = someOf({
	exclusive: T,
	cannotCreate: choiceVerb('via', ['givesAbility', 'changesCharacter']),
	cannotChoose: verb(),
	givenInstead: verb(
		{
			instead: oneOf(GIVEN_INSTEAD),
			type: opt(oneOf(CHARACTER_TYPES)),
			upTo: opt(COUNT),
			where: opt(oneOf(GIVEN_WHERE))
		},
		{ key: 'instead', spec: oneOf(GIVEN_INSTEAD), is: 'string' }
	),
	noTurnGood: verb(),
	spareToken: verb(),
	storytellerChooses: verb(
		{
			what: oneOf(STORYTELLER_CHOOSES),
			via: opt(oneOf(CHOOSES_VIA)),
			creating: opt(oneOf(['partner']))
		},
		{ key: 'what', spec: oneOf(STORYTELLER_CHOOSES), is: 'string' }
	),
	wakes: choiceVerb('how', ['one-by-one']),
	alsoBecomes: verb(
		{ type: oneOf(SEATED_TYPES), players: opt(oneOf(['drafter', 'neighbours'])) },
		{ key: 'type', spec: oneOf(SEATED_TYPES), is: 'string' }
	),
	carriedBy: verb({ type: opt(oneOf(CHARACTER_TYPES)), marked: opt(STR) }),
	diesWhenExecuted: verb(),
	registersTo: verb({
		alignments: opt(anyOf(ALIGNMENTS)),
		types: opt(anyOf(CHARACTER_TYPES)),
		always: opt(T)
	}),
	impairs: verb(
		{ kind: oneOf(IMPAIR_KINDS), unlessImpaired: opt(T) },
		{ key: 'kind', spec: oneOf(IMPAIR_KINDS), is: 'string' },
		oneOf([...JINX_WHO, 'both'])
	),
	noKill: verb(
		{ on: opt(oneOf(NO_KILL_TRIGGERS)), killer: opt(oneOf(['demon'])), token: opt(STR) },
		{ key: 'on', spec: oneOf(NO_KILL_TRIGGERS), is: 'string' }
	),
	protects: verb(
		{ from: opt(oneOf(PROTECTS_FROM)), night: opt(T), by: opt(oneOf(['partner'])) },
		{ key: 'from', spec: oneOf(PROTECTS_FROM), is: 'string' }
	),
	grimoire: verb(
		{
			hides: variants(
				{ label: 'All', is: 'string', spec: oneOf(['all']) },
				{ label: 'Some', is: 'array', spec: anyOf(GRIMOIRE_HIDDEN) }
			)
		},
		{ key: 'hides', spec: oneOf(['all']), is: 'string' }
	),
	endsGame: verb({
		kind: oneOf(JINX_END_KINDS),
		winner: opt(ALIGNMENT),
		end: opt(oneOf(GAINED_ENDS)),
		chooser: opt(WHO),
		token: opt(STR),
		day: opt(COUNT),
		alive: opt(COUNT),
		player: opt(WHO)
	}),
	deadAtLeast: verb({ dead: COUNT }, { key: 'dead', spec: COUNT, is: 'number' }),
	nightChoice: verb({
		chooses: oneOf(NIGHT_CHOICE_CHOOSES),
		partner: oneOf(NIGHT_CHOICE_PARTNER)
	}),
	partnerSetup: verb(),
	partnerInPlay: verb(),
	learns: choiceVerb('what', LEARNS),
	trueInfo: verb(),
	notDeclared: verb(),
	keepsProtection: verb(),
	noExecuteNow: verb(
		{ player: oneOf(NO_EXECUTE_NOW_PLAYER), token: opt(STR) },
		{ key: 'player', spec: oneOf(NO_EXECUTE_NOW_PLAYER), is: 'string' }
	),
	allEvilBecome: verb(),
	partnerKeepsAbility: verb(),
	storytellerHas: choiceVerb('once', STORYTELLER_HAS),
	arbitraryDeaths: verb(),
	changesCharacter: verb({ token: STR }, { key: 'token', spec: STR, is: 'string' }),
	guessesPartner: verb(),
	notShown: choiceVerb('what', NOT_SHOWN),
	notSecondDemon: verb(),
	keepsAbility: verb({ afterDeath: T }),
	survives: choiceVerb('on', ['carrier-executed']),
	killsMarked: verb({ token: STR }, { key: 'token', spec: STR, is: 'string' }),
	madAsPartner: verb(),
	thinksPartnerSetup: verb(),
	voter: verb({ countsOnlyWith: T }),
	abnormalCounts: choiceVerb('counts', ABNORMAL_COUNTS),
	// Parts of the character's own rules in place of its own while the jinx holds: any part,
	// so written as rules text.
	patch: verb({ parts: TEXT })
});

/** A character's jinxes: one entry per jinxed partner. */
export const JINX_FIELDS: FieldSpec = byCharacter(JINX);
