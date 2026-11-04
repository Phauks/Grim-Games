/**
 * What each jinx verb works through (`JINX_NEEDS`, `data/jinx-rules.ts`), and the checks that
 * need both characters of a pair: a prerequisite on the partner's side, and an effect both
 * files set for the same character. Also how a condition reads from the partner's file.
 */
import type {
	AbnormalCountsRule,
	CannotCreate,
	JinxCondition,
	JinxEffect,
	JinxFlag,
	JinxRuleKey,
	JinxRules,
	Learns,
	NoKill,
	NotShown,
	StorytellerChooses,
	StorytellerHas
} from './jinx-rules.ts';
import type { CharacterId } from './types.ts';
import type { Issues, Json } from './validate.ts';

/** The character an effect is about, `self` or `partner` of the file it is in. */
export function subjectOf(effect: JinxEffect | true): 'self' | 'partner' | 'both' {
	return effect === true ? 'self' : (effect.who ?? 'self');
}

/** A requirement: one of `parts` in the rules of the effect's subject, or of the other one. */
export interface JinxNeed {
	on: 'subject' | 'other';
	parts: readonly string[];
}

const GAINS = ['gainsAbilityOf', 'gainedFrom'];
const ABOUT_HOLDER = (e: JinxEffect) => e.when?.includes('has-partner-ability') === true;

/**
 * The other rules each verb works through, so an effect without them does nothing: on its
 * subject (whose behaviour it changes) or on the other character.
 */
export const JINX_NEEDS: Partial<Record<JinxRuleKey, (e: JinxEffect) => JinxNeed[]>> = {
	cannotCreate: (e) => [{ on: 'subject', parts: [(e as CannotCreate).via] }],
	givenInstead: () => [{ on: 'subject', parts: ['givesAbility'] }],
	noTurnGood: () => [{ on: 'subject', parts: ['givesAbility', 'changesCharacter'] }],
	spareToken: () => [{ on: 'subject', parts: ['givesAbility', 'changesCharacter'] }],
	storytellerChooses: (e) => {
		const { what, via } = e as StorytellerChooses;
		if (what === 'another-player') return [];
		if (what === 'own-execution') return [{ on: 'subject', parts: ['nomineesNominate'] }];
		if (via === 'carrierIsDemon') return [{ on: 'subject', parts: ['carrierIsDemon'] }];
		return [{ on: ABOUT_HOLDER(e) ? 'other' : 'subject', parts: ['changesCharacter'] }];
	},
	alsoBecomes: () => [{ on: 'subject', parts: ['changesCharacter'] }],
	carriedBy: () => [{ on: 'subject', parts: ['carrierIsDemon'] }],
	diesWhenExecuted: () => [{ on: 'subject', parts: ['protects'] }],
	impairs: (e) => (ABOUT_HOLDER(e) ? [{ on: 'subject', parts: GAINS }] : []),
	noKill: (e) =>
		(e as NoKill).on === 'token' ? [{ on: 'other', parts: ['stopsWaking', 'stopsKilling'] }] : [],

	deadAtLeast: () => [{ on: 'subject', parts: ['wakesWhen'] }],
	partnerSetup: () => [
		{ on: 'subject', parts: GAINS },
		{ on: 'other', parts: ['setupModifier'] }
	],
	partnerInPlay: () => [{ on: 'subject', parts: GAINS }],
	learns: (e) =>
		['ability', 'answer'].includes((e as Learns).what)
			? [{ on: 'subject', parts: ['gainedFrom'] }]
			: [],
	trueInfo: () => [{ on: 'subject', parts: ['falseInfo'] }],
	keepsProtection: () => [{ on: 'subject', parts: ['protects'] }],
	noExecuteNow: () => [{ on: 'subject', parts: ['executionOutcome'] }],
	allEvilBecome: () => [{ on: 'subject', parts: ['changesCharacter'] }],
	partnerKeepsAbility: () => [{ on: 'subject', parts: ['impairs'] }],
	storytellerHas: (e) =>
		(e as StorytellerHas).once === 'changed' ? [{ on: 'other', parts: ['changesCharacter'] }] : [],
	arbitraryDeaths: () => [{ on: 'subject', parts: ['changesCharacter'] }],
	changesCharacter: () => [{ on: 'subject', parts: ['changesCharacter'] }],
	notShown: (e) =>
		(e as NotShown).what === 'given-ability' ? [{ on: 'other', parts: ['givesAbility'] }] : [],
	notSecondDemon: () => [{ on: 'subject', parts: ['becomes'] }],
	keepsAbility: () => [{ on: 'other', parts: ['keepsAbility'] }],
	survives: () => [{ on: 'subject', parts: ['gameEnd'] }],
	madAsPartner: () => [{ on: 'subject', parts: ['madness'] }],
	thinksPartnerSetup: () => [{ on: 'other', parts: ['setupModifier'] }],
	voter: () => [
		{ on: 'subject', parts: ['voter'] },
		{ on: 'other', parts: ['voting'] }
	],
	abnormalCounts: (e) =>
		(e as AbnormalCountsRule).counts === 'unlike-demon'
			? [{ on: 'other', parts: ['choosesLikeDemon'] }]
			: []
};

/**
 * The needs of `rules` (one jinx as written in one file) that fall on that file's own
 * character (`side: "self"`) or on the partner (`"partner"`), each with its key.
 */
export function jinxNeedsOn(
	rules: JinxRules,
	side: 'self' | 'partner'
): { key: JinxRuleKey; parts: readonly string[] }[] {
	return (Object.entries(rules) as [JinxRuleKey, JinxEffect | true][]).flatMap(([key, effect]) => {
		const subject = subjectOf(effect);
		if (effect === true || subject === 'both') return [];
		return (JINX_NEEDS[key]?.(effect) ?? []).flatMap((need) => {
			const on = need.on === 'subject' ? subject : subject === 'self' ? 'partner' : 'self';
			return on === side ? [{ key, parts: need.parts }] : [];
		});
	});
}

/**
 * What `owner`'s `jinxes` block needs of each partner's rules (`rulesOf`), and each effect both
 * files set for the same character, as issues under `path`: a conflict would leave one silently
 * unread.
 */
export function jinxPartnerIssues(
	owner: CharacterId,
	jinxes: Readonly<Record<CharacterId, JinxRules>>,
	rulesOf: (id: CharacterId) => { jinxes?: Readonly<Record<CharacterId, JinxRules>> } | undefined,
	path: string,
	issues: Issues
): void {
	for (const [partner, rules] of Object.entries(jinxes)) {
		const theirs = rulesOf(partner) as Json | undefined;
		if (!theirs) continue;
		for (const { key, parts } of jinxNeedsOn(rules, 'partner'))
			if (!parts.some((p) => theirs[p] !== undefined))
				issues.add(
					`${path}.${partner}.${key}`,
					`needs ${parts.map((p) => `\`${p}\``).join(' or ')} in ${partner}'s rules`
				);
		const other = rulesOf(partner)?.jinxes?.[owner];
		if (!other || owner >= partner) continue;
		for (const [key, effect] of Object.entries(rules) as [JinxRuleKey, JinxEffect | true][]) {
			const mine = subjectOf(effect);
			const twin = other[key];
			if (twin === undefined) continue;
			const flipped = { self: 'partner', partner: 'self', both: 'both' }[subjectOf(twin)];
			if (key === 'exclusive' || mine === flipped || mine === 'both' || flipped === 'both')
				issues.add(`${path}.${partner}.${key}`, `also set in ${partner}'s file`);
		}
	}
}

const FLIP: Partial<Record<JinxFlag, JinxFlag>> = {
	'self-alive': 'partner-alive',
	'partner-alive': 'self-alive',
	'self-dead': 'partner-dead',
	'partner-dead': 'self-dead',
	'self-executed': 'partner-executed',
	'partner-executed': 'self-executed',
	'nominated-partner': 'nominated-by-partner',
	'nominated-by-partner': 'nominated-partner',
	'self-in-play': 'partner-in-play',
	'partner-in-play': 'self-in-play',
	'has-partner-ability': 'partner-has-this-ability',
	'partner-has-this-ability': 'has-partner-ability'
};

/**
 * A condition as the partner's file would say it: `self` and `partner` swap, inside a `not`
 * too; a third character's (`alive`, `inPlay`) and the game's own (a day, an execution) stay.
 */
export function flipCondition(c: JinxCondition): JinxCondition {
	if (typeof c === 'string') return FLIP[c] ?? c;
	if ('not' in c) return { not: flipCondition(c.not) };
	if ('marked' in c) return { partnerMarked: c.marked };
	if ('partnerMarked' in c) return { marked: c.partnerMarked };
	if ('alignment' in c) return { partnerAlignment: c.alignment };
	if ('partnerAlignment' in c) return { alignment: c.partnerAlignment };
	return c;
}
