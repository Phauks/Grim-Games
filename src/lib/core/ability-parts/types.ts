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
import type { Learns } from '#lib/core/data/night-info-rules.ts';
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
	| {
			at: 'day';
			after?: 'first-vote-tallied' | 'first-execution';
			/** Carousel Demons: a day's number ("On day 3"), counted with Day N tokens. */
			days?: 'first' | number;
			/** Carousel Minions: "before nominations" (the Psychopath). */
			before?: 'nominations';
	  }
	/** Carousel Demons: `day` is "After day 5", the dusk that ends that day. */
	| { at: 'dusk'; day?: number }
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
	'marked-executed',
	// Carousel Townsfolk: the player its reminder marks dies (Pixie, Bounty Hunter, the Lleech's host).
	'marked-dies',
	// Carousel Townsfolk (batch 2): a player dies by execution (Cannibal); the Demon kills
	// someone (Choirboy, with `characterIs` for the King).
	'executee-dies',
	'demon-kills',
	// Rule characters (Fabled and Loric): any player dies (Hindu).
	'player-dies',
	// Carousel Minions: a player says its secret word (the Mezepheles).
	'said-word',
	// Carousel Demons: any execution.
	'player-executed',
	// Carousel Outsiders & Travellers batch: its own player nominates (Golem), a Minion
	// publicly guesses it (Damsel), a player becomes a Minion mid-game (Damsel).
	'nominates',
	'minion-guess',
	'new-minion'
] as const;
export type GameEvent = (typeof EVENTS)[number];

/** How often: "Once per game", or only "The 1st time". */
export const LIMITS = [
	'once-per-game',
	'first-time',
	// Carousel Outsiders & Travellers batch: "Once per day" (Gangster).
	'once-per-day'
] as const;
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
	'killed',
	// Carousel Townsfolk: one of the copies of this character, the Storyteller's pick, maybe
	// its own (the Village Idiot's drunk extra).
	'a-copy',
	// Rule characters (Fabled and Loric), who have no player of their own:
	// `evil-players`: every evil player (Storm Catcher); `nominee`: today's nominee (Bigwig);
	// `marked`: the players carrying this clause's reminder (Duchess's visitors, the Ug hat);
	// `one-of-marked`: one of them, the Storyteller's pick; `died`: the player whose death set
	// this off, or who died tonight in a night clause (Hindu, Tor); `an-ally`: a player of the
	// acting player's alignment, the Storyteller's pick (Doomsayer).
	'evil-players',
	'nominee',
	'marked',
	'one-of-marked',
	'died',
	'an-ally',
	// Carousel Minions: who said the secret word (Mezepheles); every Townsfolk (Xaan).
	'speaker',
	'each-townsfolk',
	// Carousel Demons: "a player might die", any player the Storyteller picks, maybe its own
	// (Legion, Lil' Monsta, Yaggababble); every Minion (the Riot).
	'a-player',
	'each-minion',
	// Carousel Outsiders & Travellers: the Storyteller (Plague Doctor), the Minion and Demon
	// players (Hatter), a player of its own alignment (Gnome's Amigo).
	'storyteller',
	'minions-and-demon',
	'allied-player'
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
	// Carousel Demons:
	/** Someone else makes the choice: "Minions choose" (Lil' Monsta). */
	by?: 'minions';
	/** As many as the usual number of Minions, in place of `count` (the Kazali). */
	countOf?: 'minions';
	/** Only characters of this type: "which players are which Minions" (the Kazali). */
	/** Carousel Minions: only characters of this type (the Summoner's Demon). */
	type?: CharacterType;
	/** Carousel Outsiders & Travellers batch: only its alive neighbours (Gangster). */
	neighbour?: true;
}

/**
 * Conditions a clause needs, all of them. `alive` counts living players (`travellers: false`
 * leaves Travellers out, as the Scarlet Woman's text says); `noExecutionToday` is the Mayor's;
 * `registers` checks how a subject registers to this ability (Virgin, Slayer).
 */
export type Condition =
	| { alive: { atLeast?: number; exactly?: number; travellers?: false } }
	| { noExecutionToday: true }
	| {
			registers: {
				who: Subject;
				types?: CharacterType[];
				alignments?: Alignment[];
				/** Carousel Outsiders & Travellers batch: does NOT register so (Golem's "not the Demon"). */
				not?: true;
			};
	  }
	/** In a jinx's clause: the subject is the jinxed partner's player. */
	| { partnerIs: Subject }
	/** Something about today or this choice that only this ability's moment knows. */
	/** `token` marks the player it is about (the Godfather's Died Today). */
	| {
			today: 'no-death' | 'outsider-died' | 'statement-true' | 'good-voted' | 'said-phrase';
			token?: ReminderLabel;
	  }
	| {
			choice:
				| 'guess-wrong'
				| 'last-was-none'
				| 'they-agree'
				| 'impaired'
				| 'won-roshambo'
				| 'claimed-character'
				// Carousel Demons: the chosen character isn't in play (Ojo); a chosen player chose
				// to die, or all chose to live (Al-Hadikhia).
				| 'not-in-play'
				| 'chose-death'
				| 'all-chose-life';
	  }
	// Carousel Demons: while the player its token marks lives (the Lleech's host); once this
	// many players of an alignment have been executed (the Leviathan).
	| { carrierAlive: ReminderLabel }
	| { executions: { alignment: Alignment; atLeast: number } }
	| CarouselTownsfolkCondition
	| { neighboursGood: true }
	/** Only the first time this happens (the Fang Gu's first Outsider). */
	| { firstTime: true }
	// Carousel Townsfolk: its player was mad as the marked character (Pixie); the dead equal
	// or outnumber the living (King).
	| { wasMad: true }
	| { deadAtLeastLiving: true }
	/** Carousel Townsfolk: every good player joined the cult today (Cult Leader). */
	| { today: 'all-good-join' }
	// Rule characters: only the first N times (the Hindu's first 4 deaths); the final day
	// (Ferryman); a nominee mad as a character other than one they claimed before (Ventriloquist).
	| { firstTimes: number }
	| { today: 'final-day' | 'mad-as-new-character' }

	// Carousel Minions: `good-voted` (Vizier), `won-roshambo` (Psychopath), `claimed-character`
	// (Goblin); only on night N, or night X where X is the Outsiders in play (Summoner,
	// Xaan); its own player nominated the subject (Fearmonger).
	| { onNight: number | 'outsiders-in-play' }
	| { nominatedBy: Subject }

	// Carousel Outsiders & Travellers batch:
	/** The subject has this reminder (the Gnome's Amigo). */
	| { hasToken: { who: Subject; token: ReminderLabel } }
	/** Only the Storyteller can judge it (the Politician's "most responsible"). */
	| { judged: 'most-responsible-for-loss' };

/**
 * What the player learns. `measure` and `question` are the night info generators the app
 * already has (`learns` and `answers` in `character-rules.ts`), so a clause that names one
 * gets the Storyteller's truthful options for free. `character-of` and `alignment-of` show
 * a subject's character or alignment; `grimoire` is seeing the whole Grimoire.
 */
export type Info =
	| Learns
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
			/**
			 * Reminders that record the answer on the player's own seat, so they never move (the
			 * Flowergirl's Demon Voted and Demon Not Voted, the Juggler's Correct).
			 */
			records?: ReminderLabel[];
	  }
	| { kind: 'character-of'; who: Subject }
	| { kind: 'alignment-of'; who: Subject }
	| { kind: 'grimoire' }
	// Carousel Outsiders & Travellers batch: which player `who` is (the Puzzlemaster learns the
	// Demon player, everyone learns the Gnome's Amigo); that this character is in play (the
	// Damsel, to Minions); `count` bluffs (the Snitch, to Minions).
	| { kind: 'player-of'; who: Subject }
	| { kind: 'in-play' }
	| { kind: 'bluffs'; count: number }
	/**
	 * Info with no generator in the app yet (the gaps list in the design doc): how many chosen
	 * woke tonight (Chambermaid), a good and an evil character one of which is right (Dreamer),
	 * which Outsiders are in play (Godfather), two
	 * statements one true (Savant), a yes or no answer (Artist), who chose them (the Demon
	 * learns the Exorcist), each other (Evil Twin), and which of the Barista's effects it got.
	 */
	| {
			kind:
				| 'woke-tonight'
				| 'good-and-evil-character'
				| 'same-alignment'
				| 'outsiders-in-play'
				| 'true-and-false-statements'
				| 'yes-no-answer'
				| 'who-chose'
				| 'each-other'
				| 'which-effect'
				| CarouselTownsfolkInfoKind
				// Rule characters: the players a rule applies to, announced (Angel, Buddhist); how
				// many of the marked players are evil (Duchess); any true info (Zenomancer).
				| 'affected-players'
				| 'evil-among-marked'
				| 'true-info'

				// Carousel Minions: a secret word (Mezepheles), that this character is in play
				// (Widow), the night with eyes open (Wraith), 3 bluffs (Summoner), which ability
				// the Demon has (Boffin), that it chose a new player (Fearmonger).
				| 'secret-word'
				| 'in-play'
				| 'watches-night'
				| 'bluffs'
				| 'which-ability'
				| 'chose-new-player'
				// Carousel Demons: a secret phrase (Yaggababble); `in-play` is also told to everyone (Leviathan).
				| 'secret-phrase';
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
			/** `not-execution`: can only die by execution (Storm Catcher); `day`: any death by day (the Vizier). */
			from: 'demon' | 'any' | 'execution' | 'not-execution' | 'day';
			until?: 'tonight' | 'tomorrow';
			/** Only the first death doesn't happen (the Fool, the Zombuul). */
			once?: true;
	  }
	/** `allBut`: all but this many players die (Carousel: the Boomdandy). */
	| { do: 'kill'; who: Subject; ignoresProtection?: true; allBut?: number }
	| { do: 'resurrect'; who: Subject }
	| {
			do: 'impair';
			who: Subject;
			as: 'poisoned' | 'drunk';
			until?:
				| 'tonight-and-tomorrow'
				| 'dusk'
				| 'dusk-tomorrow'
				| '3-nights-and-days'
				| 'always'
				/** Until a good player dies by execution (the Cannibal's poison). */
				| 'good-executed';
			/** Ends when its own ability stops working (the Pukka's poison). */
			whileWorks?: true;
	  }
	/** Its own player loses the ability (the Witch with 3 alive). */
	| { do: 'lose-ability'; who: Subject; whileWorks?: true }
	/** Sober, healthy and true info until dusk, or the ability works twice (the Barista). */
	| { do: 'boost'; who: Subject; how: 'sober-and-true' | 'acts-twice'; until: 'dusk' }
	/** The subject keeps or regains their ability though dead (Vigormortis, Bone Collector). */
	| { do: 'keep-ability'; who: Subject; until?: 'dusk' }
	/** Gains a character's ability (Philosopher, Apprentice). */
	| {
			do: 'gain-ability';
			who: Subject;
			/** Carousel: `every-outsider` (Hermit); `a-not-in-play-good`, even while impaired (the Boffin's Demon). */
			of:
				| 'chosen'
				| 'a-townsfolk-or-minion'
				| GainedAbilityOf
				| 'marked'
				| 'a-not-in-play-good'
				| 'every-outsider';
			evenIfImpaired?: true;
	  }
	/** This type's information is false (the Vortox), or one player's (Fibbin, Duchess, the Puzzlemaster's wrong guess). */
	| { do: 'falsify-info'; of?: CharacterType; who?: Subject }
	/** The subject doesn't wake tonight (the Exorcist's Demon). */
	| { do: 'skip-waking'; who: Subject }
	/** If `who` does `on` before `until`, `effects` happen: the Witch's curse, the Devil's
	 * Advocate's "if executed tomorrow". */
	| {
			do: 'arm';
			who: Subject;
			on: 'nominates' | 'executed';
			/** `dusk`: today only (Carousel: the Goblin). */
			until: 'dusk-tomorrow' | 'dusk';
			effects: Effect[];
	  }
	/** Later tonight, if `if` holds, `effects` happen (Gossip, Moonchild). */
	| { do: 'later'; at: 'tonight'; if?: Condition[]; effects: Effect[] }
	/** "mad" about being `as`, or the Storyteller may execute them (Cerenovus, Mutant). */
	| {
			do: 'madness';
			who: Subject;
			/** `nominee-good`: mad that the nominee is good (Bigwig); `second-chosen-evil` (Harpy). */
			as: 'chosen-character' | 'outsider' | 'nominee-good' | 'second-chosen-evil';
			until?: 'dusk-tomorrow';
			/** They might die instead of being executed (Bigwig, Harpy). */
			penalty?: 'death';
	  }
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
				| 'no-private-chats'
				// Rule characters (Fabled and Loric): the Djinn's jinxes are public; veterans keep
				// quiet early each day (Buddhist); dead players vote again (Ferryman); the Demon may
				// skip an attack, and must once (Toymaker); evil's first-night info always or never
				// (Toymaker, Tor); at most one extra evil player (Spirit of Ivory); only the
				// nominee's chosen player speaks until voting (Bigwig).
				| 'jinxes-public'
				| 'veterans-silent'
				| 'dead-regain-vote'
				| 'demon-may-skip-attack'
				| 'demon-must-skip-attack-once'
				| 'evil-info-any-count'
				| 'skip-evil-info'
				| 'max-one-extra-evil'
				| 'only-chosen-speaks'

				// Carousel: eyes closed while voting, tally secret (the Organ Grinder).
				| 'secret-votes'

				// Carousel Demons: Legion's failed execution; the Riot's day 3.
				| 'execution-fails-if-only-evil-voted'
				| 'nominees-die-and-nominate';
	  }
	| { do: 'immune'; who: Subject; to: ('poisoned' | 'drunk')[] }
	| {
			do: 'register';
			who: Subject;
			/** `anything`: either alignment and any seated type (the Revolutionary's pair). */
			as: { alignments?: Alignment[]; types?: CharacterType[]; anything?: true };
			/** Only to this ability's own answers (the Fortune Teller's Red Herring). */
			toSelfOnly?: true;
			/** Only while this reminder is still in play (the Revolutionary's Register Falsely?). */
			whileToken?: ReminderLabel;
	  }
	/** Thinks they are another type (Drunk, Lunatic); `choicesAsDemon` marks their picks for the Demon. */
	| { do: 'believe'; who: Subject; isA: SeatedType; choicesAsDemon?: ReminderLabel }
	| {
			do: 'become';
			who: Subject;
			into:
				| 'demon'
				| 'this-character'
				| 'chosen-character'
				| 'alignment-of-chooser'
				// Carousel Townsfolk: an alive neighbour's alignment (Cult Leader).
				| 'alignment-of-neighbour'
				/** A Townsfolk not in play (the Huntsman's Damsel). */
				| 'not-in-play-townsfolk'
				/** A Traveller of the same alignment (Hindu). */
				| 'traveller'
				/** Only the alignment changes (the Mezepheles). */
				| 'evil'
				/** A Minion the Storyteller picks (the Lord of Typhon's neighbours). */
				| 'minion'

				// Carousel Outsiders & Travellers the chosen player's alignment (Ogre), the
				// other alignment (Politician).
				| 'alignment-of-chosen'
				| 'other-alignment';
			evil?: true;
	  }
	| { do: 'execute'; who: Subject; instead?: true }
	/** `chosen-publicly`: all players choose the winner (Fiddler). */
	| {
			do: 'end-game';
			winner: 'own-team' | 'other-team' | Alignment | 'chosen-publicly';
			/** Whose team, when not its own player's (the Fearmonger's executed). */
			of?: Subject;
	  }
	/** Good can't win while both live (the Evil Twin); one more day (the Mastermind). */
	| { do: 'hold-game'; while?: 'both-alive'; extraDay?: true }
	/** The subject registers as dead while alive (the Zombuul). */
	| { do: 'register-dead'; who: Subject }
	| { do: 'redirect-death'; to: Subject }
	| { do: 'vote-weight'; who: Subject; counts: number; until?: 'tomorrow' }
	| { do: 'vote-only-with'; who: Subject; with: Subject; until: 'tomorrow' }
	| { do: 'vote-needs-token'; who: Subject }
	// Carousel Outsiders & Travellers batch: must vote on every nomination (Zealot); whoever
	// wins loses and whoever loses wins (Heretic).
	| { do: 'must-vote'; who: Subject }
	| { do: 'invert-winner' }
	| { do: 'setup'; modifier: SetupModifierRules }
	| { do: 'storyteller'; note: string }
	/** Carousel Townsfolk: the subject kills no one tonight (the Lycanthrope's and the Princess's Demon). */
	| { do: 'stop-kills'; who: Subject; until?: 'tonight' }
	| CarouselTownsfolkEffect;

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
	/**
	 * Rule characters (Fabled and Loric) have no player: who acts on this clause, when not the
	 * Storyteller (each living player for the Doomsayer, the Demon for the Fiddler, the nominee
	 * for the Bigwig).
	 */
	actor?: Subject;
	/** Carousel Outsiders & Travellers batch: "even if drunk or poisoned" (Ogre). */
	evenIfImpaired?: true;
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

// --- Carousel Townsfolk (batch 2) -------------------------------------------------------

/**
 * - `choice: guess-right`: a public guess the Storyteller judges right (the Alsaahir);
 * - `characterIs`: the subject is a given character, by id (the Huntsman's Damsel, the
 *   Choirboy's King). Data may name a character; rules code never does;
 * - `today: own-nominee-executed`: its player nominated today's executee (the Princess).
 */
export type CarouselTownsfolkCondition =
	| { choice: 'guess-right' }
	| { characterIs: { who: Subject; id: string } }
	| { today: 'own-nominee-executed' };

/** Info with no generator: how close a guess was (Amnesiac). */
export type CarouselTownsfolkInfoKind = 'guess-accuracy';

/** Whose ability is gained: a Minion's (Alchemist), the executee's (Cannibal), one the Storyteller makes up (Amnesiac). */
export type GainedAbilityOf = 'a-minion' | 'executed' | 'storyteller-choice';

export type CarouselTownsfolkEffect =
	/** Nominations a day and votes per nomination, from now on (the Banshee). */
	| { do: 'vote-rights'; who: Subject; nominations?: number; votes?: number }
	/**
	 * Changes what evil learns on the first night: they don't learn each other (`hidden`, the
	 * Poppy Grower), they do now (`restored`), or this player shows as both (`shown-as-both`,
	 * the Magician: a Minion to the Demon, the Demon to Minions).
	 */
	| { do: 'evil-info'; change: 'hidden' | 'restored' | 'shown-as-both' };
