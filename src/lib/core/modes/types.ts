/**
 * Game modes: community formats that change fundamental parts of a game (Trevor,
 * 2026-10-17). A mode is plain data in this format, so the app can show every part of it
 * (Inspect) and anyone can write one: a mode lists only the parts it changes, and every part
 * it leaves out stays standard.
 *
 * The parts are the ones the researched modes change between them
 * (/mnt/project-files/game-modes/what-modes-change.md). Each part is either data (characters,
 * numbers) or a choice from a fixed set of behaviours, never rules prose: the mode's own
 * rules are linked, not retold (no authored content, Trevor 2026-10-15).
 */
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { SeatedType, TypeCounts } from '#lib/core/rules/distribution.ts';
import type { CountOp } from '#lib/core/rules/setup-modifiers.ts';

/** Bumped when the format changes incompatibly; `parseGameMode` reads older versions. */
export const GAME_MODE_FORMAT = 1;

/** A page a mode or one of its parts comes from. */
export interface SourceLink {
	/** The page's own title, or the site's name. */
	title: string;
	url: string;
}

/** Every part a mode can change, in the order Inspect shows them. */
export const MODE_PARTS = [
	'pool',
	'restricted',
	'counts',
	'setupModifiers',
	'assignment',
	'duplicates',
	'forced',
	'ruleChanges',
	'information',
	'bluffs',
	'daySteps',
	'winConditions',
	'towns',
	'participants',
	'betweenGames'
] as const;
export type ModePart = (typeof MODE_PARTS)[number];

/** Fields every part carries: where its rule comes from, and how the Storyteller runs it. */
interface Cited {
	/** The source for this part, when it is not the mode's first source. */
	cite?: string;
	/**
	 * What the Storyteller does for this part when the app doesn't run it, so the file alone
	 * says what a game needs (Trevor, 2026-10-19: the JSON should be "self-sufficient for the
	 * storyteller"). Required on such parts from revision 8 (validate.ts).
	 */
	instructions?: string;
}

/** 1. Which characters the game is played with. */
export type PoolRule = Cited &
	(
		| { kind: 'script' }
		/** Every official character of these types (all seated types when absent). */
		| { kind: 'all-characters'; types?: CharacterType[] }
		/** The chosen script plus unknown extra characters from off it (`extras` per type). */
		| {
				kind: 'script-plus-hidden';
				/** The most of each type; each is a row the Storyteller may fill or leave empty. */
				extras: Partial<TypeCounts>;
				announceRange: boolean;
				/** How many there are in all, when not every row is filled. */
				count?: { min: number; max: number };
		  }
		/** The script changes from game to game (`betweenGames` says how). */
		| { kind: 'campaign'; startingScript: 'any' }
		/** One script per town (`towns`). */
		| { kind: 'per-town'; scripts: SourceLink[] }
	);

/** 2. Characters the mode keeps out; the Storyteller adds to or lifts these per game. */
export interface Restrictions extends Cited {
	/** Never in the game. */
	banned: CharacterId[];
	/** May be in play, but no player chooses or is offered them. */
	notChoosable?: CharacterId[];
	/** Only a player of `type` may take this character (Whale Buffet: Summoner). */
	onlyFor?: { characterId: CharacterId; type: SeatedType }[];
}

/** 3. How many of each character type. */
export type CountsRule = Cited &
	(
		| { kind: 'standard' }
		/** Standard counts for each town's players, towns as even as possible. */
		| { kind: 'per-town'; maxDifference: number }
	);

/** 4. Which setup modifiers ([bracketed] abilities) change the counts. */
export type SetupModifiersRule = Cited &
	(
		| { kind: 'standard' }
		/** Only these characters' setup changes apply. */
		| { kind: 'only'; characters: CharacterId[] }
		/** Applied as each is drafted; the Storyteller decides when a count is already set. */
		| { kind: 'as-chosen' }
	);

/** 5. How characters reach players. */
export type AssignmentRule = Cited &
	(
		| { kind: 'bag' }
		/**
		 * Each player is offered characters and keeps one. `offers` is the size of each offer
		 * in turn (a refused offer moves to the next, e.g. 3 → 2 → 1).
		 */
		| {
				kind: 'draft';
				offers: number[];
				/** Characters not kept go back in the pool instead of being discarded. */
				recycleUnchosen: boolean;
				/** Every offer to one player is of one character type. */
				oneTypePerOffer: boolean;
		  }
		/** The bag deals a character type; each player chooses a character of it. */
		| {
				kind: 'choose-own';
				when: 'first-night';
				/** The Storyteller may ask a player to choose again. */
				reconsider: boolean;
		  }
	);

/** 6. Several players with the same character. */
export type DuplicatesRule = Cited &
	(
		| { kind: 'standard' }
		| {
				kind: 'allowed';
				/** Extra copies may be drunk. */
				extrasMayBeDrunk: boolean;
				/** Types that still have one copy each; every type repeats when left out (revision 14). */
				notTypes?: CharacterType[];
		  }
	);

/** 7. Characters always in the game. */
export interface ForcedRule extends Cited {
	/** Always in play (dealt to a player). Left out when none is (revision 12). */
	inPlay?: CharacterId[];
	/** Always on the script, in play or not. */
	onScript?: CharacterId[];
	/** Rule characters (Fabled, Loric) always in the game. */
	ruleCharacters?: CharacterId[];
	/** A homebrew rule character the mode needs, by its own rules page (not in TPI data). */
	homebrew?: SourceLink[];
}

/** 8 and 9. Rules the Storyteller runs by hand: which characters, and where to read them. */
export interface LinkedRule extends Cited {
	/** Left out when the rule concerns no particular character (revision 12). */
	characters?: CharacterId[];
}

/**
 * Demon bluffs: `none` when the Demon learns no not-in-play characters (Trevor, 2026-10-18:
 * Sushi Buffet and Whale Buffet have no Demon bluffs).
 */
export type BluffsRule = Cited & { kind: 'standard' | 'none' };

/** 10. Steps added to each day. */
export type DayStep = Cited &
	(
		| {
				kind: 'town-representative';
				/** Players the representative moves to the other town at the end of day N + 1. */
				movesPerDay: number[];
		  }
		/**
		 * Spectators vote on how their shared ability is used (Specters). `when` they vote;
		 * the player they `pick` gains the `grants` character's ability, for as long as `lasts`.
		 */
		| {
				kind: 'spectator-vote';
				/** The shared ability's name, e.g. Apparition. */
				ability?: string;
				when?: 'each-dawn';
				pick?: 'player';
				grants?: CharacterId[];
				lasts?: 'until-next-dawn';
		  }
	);

/** 11. How the game is won. */
export type WinRule = Cited &
	(
		| { kind: 'standard' }
		/** Good also wins as soon as any Demon dies by execution (Binary Supernovae). */
		| { kind: 'demon-executed' }
		/**
		 * A team wins by winning every town. When towns split after `afterDay` days, `winner`
		 * wins if `together` are in one town, else the other team does.
		 */
		| {
				kind: 'all-towns';
				splitTiebreak: {
					afterDay: number;
					together: CharacterId[];
					winner: 'good' | 'evil';
				};
		  }
	);

/** 12. More than one town (grimoire) in one game. */
export interface TownsRule extends Cited {
	count: number;
	storytellers: number;
	/** Every player plays in every town at once, with a character in each. */
	samePlayers?: boolean;
	/** A player can't have a character of these types in more than one town. */
	notInEveryTown?: SeatedType[];
	/** Characters always in play in each town, by town (part 7's `inPlay`, placed). */
	inPlay?: CharacterId[][];
}

/** 13. People taking part without a seat. */
export interface ParticipantsRule extends Cited {
	spectators: 'shared-ability';
}

/** 14. What happens between games of a campaign. */
export interface BetweenGamesRule extends Cited {
	kind: 'campaign';
	/** Executed characters are eliminated: `every` executed, or only the `last`. */
	eliminate: 'every-executed' | 'last-executed';
	/** An eliminated character is replaced by one of the same type that is still available. */
	replaceSameType: boolean;
	/** The script each game aims for. */
	target: TypeCounts;
	/** Demons are added one per game until `target.demon`. */
	growDemons: boolean;
	endConditions: CampaignEnd[];
}

export const CAMPAIGN_ENDS = [
	'no-demons',
	'deathmatch',
	'domination',
	'first-blood',
	'attrition',
	'mercy',
	'rush',
	'stockpile',
	'fixed-games',
	'fixed-time',
	'endless'
] as const;
export type CampaignEnd = (typeof CAMPAIGN_ENDS)[number];

export interface ModeParts {
	pool?: PoolRule;
	restricted?: Restrictions;
	counts?: CountsRule;
	setupModifiers?: SetupModifiersRule;
	assignment?: AssignmentRule;
	duplicates?: DuplicatesRule;
	forced?: ForcedRule;
	ruleChanges?: LinkedRule[];
	information?: LinkedRule[];
	bluffs?: BluffsRule;
	daySteps?: DayStep[];
	winConditions?: WinRule;
	towns?: TownsRule;
	participants?: ParticipantsRule;
	betweenGames?: BetweenGamesRule;
}

export interface GameMode {
	/** Absent in files written before special rules existed (Trevor, 2026-10-18). */
	kind?: 'game-mode';
	format: typeof GAME_MODE_FORMAT;
	/** Lower-case letters, digits and dashes; unique among modes. */
	id: string;
	/** The name its community uses. */
	name: string;
	/** Other names it goes by (searched, shown in Inspect). */
	aliases?: string[];
	/**
	 * Where its rules come from, the rules page first. Empty for a mode no page describes
	 * (Trevor, 2026-10-19: his own notes are not a source).
	 */
	sources: SourceLink[];
	/**
	 * Who made the mode, each linked to a page that names them as its author (Trevor,
	 * 2026-10-18: no author unless properly attributed). Thanks and testers are not authors.
	 */
	authors?: SourceLink[];
	/**
	 * A short description of how the mode plays, shown on New game and in Inspect. Trevor
	 * asked for one per mode (2026-10-18); the built-in ones are our own wording, not the
	 * sources', which are linked.
	 */
	about?: string;
	/** Parts no source confirms; Inspect marks them. */
	unconfirmed?: ModePart[];
	parts: ModeParts;
}

/**
 * Special rules (Trevor, 2026-10-18: "Yes, split"): a game has one game mode, and any number
 * of special rules on top. A mode may replace what the game is played with or how it is
 * dealt (pool, assignment, towns, between games); a rule only adds to a game, so several can
 * stack. The World Cup 2025 scripts carry their rule this way, as Bootlegger lines
 * (https://botc-script-viewer.sthom.kiwi/wc25/). Design:
 * /mnt/project-files/world-cup-rules/format-design.md.
 */
export const SPECIAL_RULE_FORMAT = 1;

/** The game mode parts a special rule may also set: the ones that add to a game. */
export const STACKING_PARTS = [
	'pool',
	'restricted',
	'setupModifiers',
	'duplicates',
	'forced',
	'ruleChanges',
	'information',
	'bluffs',
	'daySteps',
	'winConditions',
	'participants'
] as const satisfies readonly ModePart[];
export type StackingPart = (typeof STACKING_PARTS)[number];

/** Parts only a special rule sets, in the order Inspect shows them. */
export const RULE_ONLY_PARTS = [
	'text',
	'countChanges',
	'travellers',
	'seats',
	'deaths',
	'nightSteps',
	'abilities',
	'demonAttacks',
	'nominations'
] as const;
export type RuleOnlyPart = (typeof RULE_ONLY_PARTS)[number];

/** Every part a special rule can set. */
export const RULE_PARTS = [...STACKING_PARTS, ...RULE_ONLY_PARTS] as const;
export type RulePart = (typeof RULE_PARTS)[number];

/** Travellers dealt from the bag like other characters (Stowed Away). */
export interface TravellersRule extends Cited {
	/** At most this many Travellers in the bag; the other counts are for that many fewer players. */
	inBag: number;
	/** Whether the table is told which players are Travellers. */
	announced: boolean;
}

/** A seat no one plays; the Storyteller may speak for it (The Ballad of Seat 7). */
export interface SeatsRule extends Cited {
	kind: 'storyteller-seat';
	count: number;
	speaks: 'never' | 'once-per-game';
}

/** Deaths the Storyteller does not announce (I See Dead People). */
export interface DeathsRule extends Cited {
	kind: 'private';
}

/** A step added to each night, or to one night, for these characters, types or the dead. */
export interface NightStep extends Cited {
	kind: 'wake';
	when: 'each-night' | 'each-night-except-first' | 'one-night';
	/** The night, for `one-night` (1 is the first night). */
	night?: number;
	characters?: CharacterId[];
	types?: SeatedType[];
	/** Every dead player wakes, together (Council of the Dead). */
	dead?: boolean;
	/** How long they wake for, in minutes. */
	minutes?: number;
}

/** Who has an ability, alive or dead (The Phantom Detectives). */
export interface AbilitiesRule extends Cited {
	kind: 'dead-keep';
	/** Dead players keep their abilities, except these types. */
	deadLose: SeatedType[];
	/** Living players of these types have no ability until they die. */
	livingLose: SeatedType[];
}

/** Who the Demon attacks each night (Trained Killer). */
export interface DemonAttacksRule extends Cited {
	/** The next living in-play character in script order, after the last one it killed. */
	kind: 'script-order';
}

/**
 * What a nomination sets off (The Warrens, The Djinn's Bargain). The board offers it to the
 * Storyteller when a nomination is recorded; they decide.
 */
export interface NominationEffect extends Cited {
	/**
	 * `evil-swap`: an evil nominator and a living evil nominee, neither a Traveller, swap
	 * characters. `nominator-may-die`: the nominator may choose to die, and the nominee's
	 * ability then works twice until the next dusk.
	 */
	kind: 'evil-swap' | 'nominator-may-die';
	/** Only while at least this many players are alive. */
	minAlive?: number;
}

export interface RuleOnlyParts {
	/** The rule's own lines, shown on the Bootlegger (a script's `_meta.bootlegger`). */
	text?: string[];
	/** Changes to the type counts, added to the others' ("[+1 Demon]"). */
	countChanges?: CountOp[];
	travellers?: TravellersRule;
	seats?: SeatsRule;
	deaths?: DeathsRule;
	nightSteps?: NightStep[];
	abilities?: AbilitiesRule;
	demonAttacks?: DemonAttacksRule;
	nominations?: NominationEffect[];
}

/** A special rule's pool can only add to the script. */
export type RuleParts = Omit<Pick<ModeParts, StackingPart>, 'pool'> & {
	pool?: Extract<PoolRule, { kind: 'script-plus-hidden' }>;
} & RuleOnlyParts;

/** A game mode with its special rules folded in (`combineRules`). */
export type CombinedParts = ModeParts & RuleOnlyParts;

export interface SpecialRule {
	kind: 'special-rule';
	format: typeof SPECIAL_RULE_FORMAT;
	/** Lower-case letters, digits and dashes; unique among special rules. */
	id: string;
	name: string;
	aliases?: string[];
	/** Where the rule comes from; empty only for a script's own rule, which is the script. */
	sources: SourceLink[];
	authors?: SourceLink[];
	about?: string;
	unconfirmed?: RulePart[];
	/** Modes and rules this one can't sensibly be played with; choosing both warns. */
	conflictsWith?: { modes?: string[]; rules?: string[] };
	parts: RuleParts;
}
