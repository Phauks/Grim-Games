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
 * - `day`: during each day, or only `after` something today (the first vote's tally, the first
 *   execution); `days: first` is "On your 1st day".
 * - `always`: a lasting state, no moment of its own ("You are safe from the Demon").
 * - `death`: its own player dies, by `by`, at `phase`; `would` when the death may not happen
 *   (the Mayor's "might die instead"); `learned` is "When you learn that you died" (by day).
 * - `nominated`: its own player is nominated.
 * - `event`: something else in the game happens (`EVENTS`).
 */
export type When =
	| { at: 'setup' }
	| { at: 'night'; nights: Nights }
	| { at: 'day'; after?: 'first-vote-tallied' | 'first-execution'; days?: 'first' }
	| { at: 'dusk' }
	| { at: 'always' }
	| {
			at: 'death';
			by?: 'execution' | 'demon' | 'any';
			phase?: 'night' | 'day';
			would?: true;
			learned?: true;
	  }
	| { at: 'nominated' }
	| { at: 'event'; event: GameEvent };

/**
 * Things that happen that an ability waits for: the Demon dies (Scarlet Woman), its own
 * player kills themself with this ability (the Imp's star pass), a player of its alignment
 * is executed (Scapegoat), a dead player gives it their vote token (Beggar), a Minion dies
 * by execution (Minstrel), the Demon dies by execution (Mastermind), its player is chosen by
 * another ability (Goon), another player nominates (Judge), its first Outsider kill (Fang Gu),
 * the Demon kills the player it marks (Grandmother), the player it marks is executed (Evil Twin).
 */
export const EVENTS = [
	'demon-dies',
	'killed-self',
	'ally-executed',
	'given-vote-token',
	'minion-executed',
	'demon-executed',
	'chosen-by-ability',
	'nomination',
	'killed-outsider',
	'grandchild-killed-by-demon',
	'marked-executed'
] as const;
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
 *   other character of the jinxed pair; `townsfolk-neighbours`: its nearest Townsfolk on each
 *   side; `last-chosen`: whom this clause chose last time (Pukka, Shabaloth); `one-of-chosen`:
 *   one of the chosen players, the Storyteller's pick (Innkeeper); `self-or-chosen`: either,
 *   the Storyteller's pick (Sailor); `the-demon`: whoever is the Demon; `each-player`: everyone
 *   but Travellers (Minstrel); `opposing-player`: a player of the other alignment (Evil Twin); `killed`: whom the ability just killed (Fang Gu).
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
	'jinxed-partner',
	'townsfolk-neighbours',
	'last-chosen',
	'one-of-chosen',
	'self-or-chosen',
	'the-demon',
	'each-player',
	'opposing-player',
	'killed'
] as const;
export type Subject = (typeof SUBJECTS)[number];

/** What the player picks: "choose a player", "choose 2 players", "choose a player (not yourself)". */
export interface Choice {
	count: number;
	/** "up to 5": any number from none to `count`. */
	upTo?: true;
	what: 'player' | 'character' | 'player-and-character';
	notSelf?: true;
	alive?: true;
	dead?: true;
	/** For a character: only good ones, or one not in play. */
	alignment?: Alignment;
	notInPlay?: true;
	/** Not Travellers (the Dreamer). */
	notTravellers?: true;
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
	| { partnerIs: Subject }
	/** Something about today or this choice that only this ability's moment knows. */
	/** `token` marks the player it is about (the Godfather's Died Today). */
	| { today: 'no-death' | 'outsider-died' | 'statement-true'; token?: ReminderLabel }
	| { choice: 'guess-wrong' | 'last-was-none' | 'they-agree' | 'impaired' }
	| { neighboursGood: true }
	/** Only the first time this happens (the Fang Gu's first Outsider). */
	| { firstTime: true };

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
	| {
			question:
				| 'executed-character'
				| 'minion-nominated'
				| 'demon-voted'
				| 'outsider-died'
				| 'correct-guesses'
				| 'evil-dead'
				| 'abnormal-abilities'
				| 'statement-true';
			token?: ReminderLabel;
	  }
	| { kind: 'character-of'; who: Subject }
	| { kind: 'alignment-of'; who: Subject }
	| { kind: 'grimoire' }
	/**
	 * Info with no generator in the app yet (the gaps list in the design doc): how many chosen
	 * woke tonight (Chambermaid), a good and an evil character one of which is right (Dreamer),
	 * whether two players share an alignment (Seamstress), the Demon among two (Sage), a good
	 * player and their character (Grandmother), which Outsiders are in play (Godfather), two
	 * statements one true (Savant), a yes or no answer (Artist), who chose them (the Demon
	 * learns the Exorcist), each other (Evil Twin), and which of the Barista's effects it got.
	 */
	| {
			kind:
				| 'woke-tonight'
				| 'good-and-evil-character'
				| 'same-alignment'
				| 'demon-one-of-two'
				| 'good-player-and-character'
				| 'outsiders-in-play'
				| 'true-and-false-statements'
				| 'yes-no-answer'
				| 'who-chose'
				| 'each-other'
				| 'which-effect';
	  };

/**
 * One thing that happens. The verbs are the Glossary's: learn, protect ("safe"), kill
 * ("dies"), poison and make drunk, register, become, execute, win or lose, plus voting
 * changes. `storyteller` is the escape hatch: a step the app shows as a note and leaves to
 * the Storyteller.
 */
export type Effect = EffectBody & {
	/** The reminder that marks this effect, when it isn't the clause's `marks` (the Innkeeper's Drunk). */
	marks?: ReminderLabel;
};

type EffectBody =
	/** `to`: who learns, when not its own player (the Demon learns who the Exorcist is). */
	| { do: 'learn'; info: Info; to?: Subject }
	| {
			do: 'protect';
			who: Subject;
			from: 'demon' | 'any' | 'execution';
			until?: 'tonight' | 'tomorrow';
			/** Only the first death doesn't happen (the Fool, the Zombuul). */
			once?: true;
	  }
	| { do: 'kill'; who: Subject; ignoresProtection?: true }
	| { do: 'resurrect'; who: Subject }
	| {
			do: 'impair';
			who: Subject;
			as: 'poisoned' | 'drunk';
			until?: 'tonight-and-tomorrow' | 'dusk' | 'dusk-tomorrow' | '3-nights-and-days' | 'always';
			/** Ends when its own ability stops working (the Pukka's poison). */
			whileWorks?: true;
	  }
	/** Its own player loses the ability (the Witch with 3 alive). */
	| { do: 'lose-ability'; who: Subject }
	/** Sober, healthy and true info until dusk, or the ability works twice (the Barista). */
	| { do: 'boost'; who: Subject; how: 'sober-and-true' | 'acts-twice'; until: 'dusk' }
	/** The subject keeps or regains their ability though dead (Vigormortis, Bone Collector). */
	| { do: 'keep-ability'; who: Subject; until?: 'dusk' }
	/** Gains a character's ability (Philosopher, Apprentice). */
	| { do: 'gain-ability'; who: Subject; of: 'chosen' | 'a-townsfolk-or-minion' }
	/** This type's information is false (the Vortox). */
	| { do: 'falsify-info'; of: CharacterType }
	/** The subject doesn't wake tonight (the Exorcist's Demon). */
	| { do: 'skip-waking'; who: Subject }
	/** If `who` does `on` before `until`, `effects` happen: the Witch's curse, the Devil's
	 * Advocate's "if executed tomorrow". */
	| {
			do: 'arm';
			who: Subject;
			on: 'nominates' | 'executed';
			until: 'dusk-tomorrow';
			effects: Effect[];
	  }
	/** Later tonight, if `if` holds, `effects` happen (Gossip, Moonchild). */
	| { do: 'later'; at: 'tonight'; if?: Condition[]; effects: Effect[] }
	/** "mad" about being `as`, or the Storyteller may execute them (Cerenovus, Mutant). */
	| { do: 'madness'; who: Subject; as: 'chosen-character' | 'outsider'; until?: 'dusk-tomorrow' }
	/** Swap characters (and alignments) between two subjects, or players' seats (Matron). */
	| {
			do: 'swap';
			who: Subject;
			with: Subject;
			what: 'character' | 'character-and-alignment' | 'seats';
	  }
	/** Changes to nominating and voting for everyone (Bishop, Voudon, Judge, Butcher, Matron). */
	| {
			do: 'game-rule';
			rule:
				| 'only-storyteller-nominates'
				| 'opposing-nominee-each-day'
				| 'only-dead-and-self-vote'
				| 'no-majority-needed'
				| 'force-execution'
				| 'nominate-again'
				| 'no-private-chats';
	  }
	| { do: 'immune'; who: Subject; to: ('poisoned' | 'drunk')[] }
	| {
			do: 'register';
			who: Subject;
			as: { alignments?: Alignment[]; types?: CharacterType[] };
			/** Only to this ability's own answers (the Fortune Teller's Red Herring). */
			toSelfOnly?: true;
	  }
	/** Thinks they are another type (Drunk, Lunatic); `choicesAsDemon` marks their picks for the Demon. */
	| { do: 'believe'; who: Subject; isA: SeatedType; choicesAsDemon?: ReminderLabel }
	| {
			do: 'become';
			who: Subject;
			into: 'demon' | 'this-character' | 'chosen-character' | 'alignment-of-chooser';
			evil?: true;
	  }
	| { do: 'execute'; who: Subject; instead?: true }
	| { do: 'end-game'; winner: 'own-team' | 'other-team' | Alignment }
	/** Good can't win while both live (the Evil Twin); one more day (the Mastermind). */
	| { do: 'hold-game'; while?: 'both-alive'; extraDay?: true }
	/** The subject registers as dead while alive (the Zombuul). */
	| { do: 'register-dead'; who: Subject }
	| { do: 'redirect-death'; to: Subject }
	| { do: 'vote-weight'; who: Subject; counts: number; until: 'tomorrow' }
	| { do: 'vote-only-with'; who: Subject; with: Subject; until: 'tomorrow' }
	| { do: 'vote-needs-token'; who: Subject }
	| { do: 'setup'; modifier: SetupModifierRules }
	| { do: 'storyteller'; note: string };

export type EffectVerb = EffectBody['do'];

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
