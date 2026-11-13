import {
	B,
	CHARACTER,
	COUNT,
	list,
	NUM,
	obj,
	oneOf,
	opt,
	optObj,
	ownWords,
	STR,
	STRS,
	T,
	TOKEN,
	variants,
	type SpecValue
} from '../field-spec.ts';
import type { CharacterId } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

export const DAY_GROUPS = [
	'day-ability',
	'nomination',
	'vote',
	'execution-death',
	'madness',
	'announcement'
] as const;
export type DayGroup = (typeof DAY_GROUPS)[number];

export const DAY_GROUP_TITLES: Record<DayGroup, string> = {
	'day-ability': 'Day abilities',
	nomination: 'Nominations',
	vote: 'Voting',
	'execution-death': 'Executions and deaths',
	madness: 'Madness',
	announcement: 'Public knowledge'
};

const SEGMENT = variants(
	{ label: 'Its player', has: 'self', spec: obj({ self: T }) },
	{ label: 'Its target', has: 'target', spec: obj({ target: T }) },
	{ label: 'The nominee', has: 'nominee', spec: obj({ nominee: T }) },
	{ label: 'Text', has: 'text', spec: obj({ text: STR }) },
	{ label: 'A value', has: 'value', spec: obj({ value: STR, placeholder: STR }) }
);
export type TemplateSegment = SpecValue<typeof SEGMENT>;

/** How a death is matched: a cause the app records, or a character id. */
export type DeathCauseMatch = 'execution' | 'exile' | 'demon' | 'other' | CharacterId;

const CONDITION = optObj({
	self: oneOf(['alive', 'dead', 'any']),
	reminder: TOKEN,
	noReminder: TOKEN,
	cause: STRS,
	minAlive: NUM,
	targetAlive: B,
	nomineeChose: T,
	noWish: T,
	day: COUNT
});
export type DayCondition = SpecValue<typeof CONDITION>;

const REMINDER = obj({ group: oneOf(DAY_GROUPS), template: list(SEGMENT), when: opt(CONDITION) });
export type DayReminderSpec = SpecValue<typeof REMINDER>;

/**
 * `other`: the character whose ability this one's registration can set off or block;
 * `otherNoReminder`: only while this reminder of `other` is on no player ("No Ability": unused).
 */
const INTERACTION = obj({
	other: CHARACTER,
	group: oneOf(DAY_GROUPS),
	text: STR,
	otherNoReminder: opt(STR)
});
export type DayInteraction = SpecValue<typeof INTERACTION>;

/**
 * What the Storyteller should watch for during the day because of a character, shown by
 * `rules/day/day-reminders.ts`.
 *
 * - `reminders`: short, state-based sentences built from segments:
 *   - `{ self: true }`: this character, shown as a badge ("[Witch · Sam]");
 *   - `{ target: true }`: the character of the player carrying the reminder token named in
 *     `when.reminder` ("[Librarian · Alex]");
 *   - `{ text }`: our own words, kept short;
 *   - `{ value, placeholder }`: a value the Storyteller entered during prep (`SetupNote.value`,
 *     stored on the game as `prepValues`), shown as `placeholder` until entered.
 * - `impairable: true`: while that player's ability does not work (drunk, poisoned, or no
 *   ability: `abilityState`), one line "[Slayer] is poisoned by [Poisoner]" replaces the
 *   character's lines about its living ability, so the two never show together.
 * - `interactions`: ways this character may register falsely and so set off or block another
 *   character's day ability (Trevor, 2026-10-16: "if the Spy is alive, it can register as
 *   good, which means it can trigger the Virgin"). Each shows while both are in play and
 *   alive, this character's ability works, and the other's is unused (`otherNoReminder`),
 *   read "[this] {text} [other]".
 * - `none`: why a character has nothing to watch by day (its ability acts at night or at
 *   setup), so the app knows it has been checked and does not guess from its ability text.
 *
 * `when` says when a reminder shows:
 * - `self: 'alive' | 'dead' | 'any'` (default 'alive');
 * - `reminder`: only while this character's reminder token is on a player; one reminder per
 *   player carrying it;
 * - `noReminder`: only while that token is NOT on any player ("No Ability": unused);
 * - `cause`: with `self: 'dead'`, only if the death's cause is one of these ('demon' also
 *   matches any Demon's id). An unknown cause counts as a match, flagged `uncertain`.
 * - `day`: only on that day, day 1 being the day after the first night (the Juggler's
 *   guesses);
 * - `minAlive`: only while at least this many players are alive;
 * - `targetAlive`: with `reminder`, only while the player carrying the token is alive;
 * - `nomineeChose: true`: one reminder per nomination today whose nominee chose a player
 *   (the Big Wig's speaker, recorded on the nomination).
 * - `noWish: true`: only while no wish of its player's has been granted (`rules/abilities/wishes.ts`);
 *   a declined wish leaves it.
 *
 * Text here is our own summary, never wiki prose.
 */
export const dayReminders = specPart(
	'day',
	'Day reminders',
	'What to watch for during the day because of it.',
	obj({
		impairable: opt(T),
		reminders: opt(list(REMINDER)),
		interactions: opt(list(INTERACTION)),
		none: opt(ownWords(STR))
	}),
	(value, path, issues) => {
		const before = issues.list.length;
		value.reminders?.forEach(({ template, when }, i) => {
			const at = `${path}.reminders[${i}]`;
			if (!template.length) issues.add(`${at}.template`, 'expected a list of segments');
			if (when?.cause?.includes(''))
				issues.add(`${at}.when.cause`, 'expected a list of death causes or character ids');
			if (when?.reminder && when.nomineeChose)
				issues.add(`${at}.when.nomineeChose`, 'a reminder or nomineeChose, not both');
			if (template.some((p) => 'target' in p) && !when?.reminder && !when?.nomineeChose)
				issues.add(`${at}.when.reminder`, 'a target segment needs the reminder that marks them');
			if (template.some((p) => 'nominee' in p) && !when?.nomineeChose)
				issues.add(`${at}.when.nomineeChose`, 'a nominee segment needs nomineeChose');
		});
		if (value.none !== undefined && value.reminders?.length)
			issues.add(`${path}.none`, 'a character with day reminders has something to watch');
		return issues.list.length > before ? undefined : value;
	}
);

export type DayReminderRules = PartValue<typeof dayReminders>;
