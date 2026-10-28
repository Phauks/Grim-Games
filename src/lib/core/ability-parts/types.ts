/**
 * SPIKE (not wired into the app): an ability as standard parts, so a custom character can
 * reuse what the app already does for official ones (Trevor, 2026-10-28). Design:
 * /mnt/project-files/ability-parts/framework.md.
 *
 * An ability is a list of clauses. Each clause says when it acts (`when`), how often
 * (`limit`), what must hold (`if`), what its player picks (`choose`) and what happens
 * (`effects`), plus the reminder that marks it on the board (`marks`). The words come from
 * TPI's ability phrasing ("Each night*", "Once per game, during the day", "choose a player")
 * and the wiki's Glossary; `derive.ts` turns clauses into the rules keys the app reads today.
 */
import type { SetupModifierRules } from '#lib/core/data/setup-modifier-rules.ts';
import type { Alignment, CharacterType, ReminderLabel, SeatedType } from '#lib/core/data/types.ts';

/** Which nights a night clause acts on: "You start knowing" / "On your 1st night" is `first`. */
export const NIGHTS = ['first', 'each', 'each*'] as const;
export type Nights = (typeof NIGHTS)[number];

/**
 * When a clause acts.
 * - `setup`: before the game, as the bag is made ("[+2 Outsiders]").
 * - `night`: on the nights in `nights` ("Each night*" is `each*`: not the first night).
 * - `day`: during each day, or only `after` something today (the first vote's tally).
 * - `always`: a lasting state, no moment of its own ("You are safe from the Demon").
 * - `death`: its own player dies, by `by`, at `phase`; `would` when the death may not happen
 *   (the Mayor's "might die instead").
 * - `nominated`: its own player is nominated.
 * - `event`: something else in the game happens (`EVENTS`).
 */
export type When =
	| { at: 'setup' }
	| { at: 'night'; nights: Nights }
	| { at: 'day'; after?: 'first-vote-tallied' }
	| { at: 'dusk' }
	| { at: 'always' }
	| { at: 'death'; by?: 'execution' | 'demon' | 'any'; phase?: 'night' | 'day'; would?: true }
	| { at: 'nominated' }
	| { at: 'event'; event: GameEvent };

/**
 * Things that happen that an ability waits for: the Demon dies (Scarlet Woman), its own
 * player kills themself with this ability (the Imp's star pass), a player of its alignment
 * is executed (Scapegoat), a dead player gives it their vote token (Beggar).
 */
export const EVENTS = ['demon-dies', 'killed-self', 'ally-executed', 'given-vote-token'] as const;
export type GameEvent = (typeof EVENTS)[number];

/** How often: "Once per game", or only "The 1st time". */
export const LIMITS = ['once-per-game', 'first-time'] as const;
export type Limit = (typeof LIMITS)[number];

/**
 * Who an effect or condition is about.
 * - `self`: the ability's own player; `chosen`: whom they chose in this clause;
 * - `nominator`, `executed`, `giver`: the player the moment names;
 * - `a-minion`: a Minion the Storyteller picks; `another-player`: any other player the
 *   Storyteller picks; `a-good-player`: a good player the Storyteller picks, maybe its own;
 *   `alive-neighbours`: its two alive neighbours; `jinxed-partner`: in a jinx's clause, the
 *   other character of the jinxed pair.
 */
export const SUBJECTS = [
	'self',
	'chosen',
	'nominator',
	'executed',
	'giver',
	'a-minion',
	'another-player',
	'a-good-player',
	'alive-neighbours',
	'jinxed-partner'
] as const;
export type Subject = (typeof SUBJECTS)[number];

/** What the player picks: "choose a player", "choose 2 players", "choose a player (not yourself)". */
export interface Choice {
	count: number;
	what: 'player' | 'character';
	notSelf?: true;
	/** Only among players who voted today (the Gunslinger). */
	from?: 'voted-today';
	/** Different to previous nights. */
	notRepeated?: true;
}

/**
 * Conditions a clause needs, all of them. `alive` counts living players (`travellers: false`
 * leaves Travellers out, as the Scarlet Woman's text says); `noExecutionToday` is the Mayor's;
 * `registers` checks how a subject registers to this ability (Virgin, Slayer).
 */
export type Condition =
	| { alive: { atLeast?: number; exactly?: number; travellers?: false } }
	| { noExecutionToday: true }
	| { registers: { who: Subject; types?: CharacterType[]; alignments?: Alignment[] } }
	/** In a jinx's clause: the subject is the jinxed partner's player. */
	| { partnerIs: Subject };

/**
 * What the player learns. `measure` and `question` are the night info generators the app
 * already has (`learns` and `answers` in `character-rules.ts`), so a clause that names one
 * gets the Storyteller's truthful options for free. `character-of` and `alignment-of` show
 * a subject's character or alignment; `grimoire` is seeing the whole Grimoire.
 */
export type Info =
	| {
			measure:
				| 'pair-of-type'
				| 'evil-pairs'
				| 'evil-alive-neighbours'
				| 'demon-minion-steps'
				| 'demon-or-token'
				| 'good-player'
				| 'one-evil-of-three';
			type?: CharacterType;
			token?: ReminderLabel;
			noneWhenAbsent?: true;
			/** Tokens to place: on the shown player, the second player, every player tapped. */
			reminders?: { target?: ReminderLabel; other?: ReminderLabel; each?: ReminderLabel };
	  }
	| { question: 'executed-character'; token?: ReminderLabel }
	| { kind: 'character-of'; who: Subject }
	| { kind: 'alignment-of'; who: Subject }
	| { kind: 'grimoire' };

/**
 * One thing that happens. The verbs are the Glossary's: learn, protect ("safe"), kill
 * ("dies"), poison and make drunk, register, become, execute, win or lose, plus voting
 * changes. `storyteller` is the escape hatch: a step the app shows as a note and leaves to
 * the Storyteller.
 */
export type Effect =
	| { do: 'learn'; info: Info }
	| { do: 'protect'; who: Subject; from: 'demon' | 'any' | 'execution'; until?: 'tonight' }
	| { do: 'kill'; who: Subject; ignoresProtection?: true }
	| {
			do: 'impair';
			who: Subject;
			as: 'poisoned' | 'drunk';
			until?: 'tonight-and-tomorrow' | 'always';
	  }
	| { do: 'immune'; who: Subject; to: ('poisoned' | 'drunk')[] }
	| {
			do: 'register';
			who: Subject;
			as: { alignments?: Alignment[]; types?: CharacterType[] };
			/** Only to this ability's own answers (the Fortune Teller's Red Herring). */
			toSelfOnly?: true;
	  }
	| { do: 'believe'; who: Subject; isA: SeatedType }
	| { do: 'become'; who: Subject; into: 'demon' | 'this-character' }
	| { do: 'execute'; who: Subject; instead?: true }
	| { do: 'end-game'; winner: 'own-team' | 'other-team' | Alignment }
	| { do: 'redirect-death'; to: Subject }
	| { do: 'vote-weight'; who: Subject; counts: number; until: 'tomorrow' }
	| { do: 'vote-only-with'; who: Subject; with: Subject; until: 'tomorrow' }
	| { do: 'vote-needs-token'; who: Subject }
	| { do: 'setup'; modifier: SetupModifierRules }
	| { do: 'storyteller'; note: string };

export type EffectVerb = Effect['do'];

/** One clause of an ability. */
export interface Clause {
	/** Unique within the character, so a jinx can point at it. */
	id: string;
	when: When;
	limit?: Limit;
	if?: Condition[];
	choose?: Choice;
	/** "publicly choose": the choice is made aloud in town. */
	publicly?: true;
	/** "you may": the player can decline. */
	optional?: true;
	/** "might": the Storyteller decides whether it happens. */
	storytellerMay?: true;
	/** "even if dead". */
	evenIfDead?: true;
	effects: Effect[];
	/** The reminder that marks this clause's effect on its subject (Safe, Poisoned, Red Herring). */
	marks?: ReminderLabel;
	/** The reminder that marks a limited clause used up (No Ability). */
	spent?: ReminderLabel;
}

/** A character's ability as parts. */
export interface AbilityParts {
	clauses: Clause[];
	/** Escape hatches this character needed, each with why (shown in the fit report). */
	hatches?: string[];
}

/**
 * A jinx as edits to the two characters' parts (TPI's jinxes are text only today):
 * - `exclusive`: only one of the pair may be in play (already a setup warning);
 * - `add`: a new clause on one character while both are in play;
 * - `suppress`: one character's clause does nothing while `while` holds;
 * - `set`: replace one clause's field;
 * - `storyteller`: a note only.
 */
export type JinxPatch =
	| { op: 'exclusive' }
	| { op: 'add'; character: string; clause: Clause }
	| { op: 'suppress'; character: string; clause: string; while: 'partner-has-ability' }
	| { op: 'set'; character: string; clause: string; field: keyof Clause; value: unknown }
	| { op: 'storyteller'; note: string };

export interface JinxParts {
	characters: [string, string];
	patches: JinxPatch[];
}
