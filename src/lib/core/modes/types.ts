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
	'daySteps',
	'winConditions',
	'towns',
	'participants',
	'betweenGames'
] as const;
export type ModePart = (typeof MODE_PARTS)[number];

/** Fields every part carries: where its rule comes from. */
interface Cited {
	/** The source for this part, when it is not the mode's first source. */
	cite?: string;
}

/** 1. Which characters the game is played with. */
export type PoolRule = Cited &
	(
		| { kind: 'script' }
		/** Every official character of these types (all seated types when absent). */
		| { kind: 'all-characters'; types?: CharacterType[] }
		/** The chosen script plus unknown extra characters from off it (`extras` per type). */
		| { kind: 'script-plus-hidden'; extras: Partial<TypeCounts>; announceRange: boolean }
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
		  }
	);

/** 7. Characters always in the game. */
export interface ForcedRule extends Cited {
	/** Always in play (dealt to a player). */
	inPlay: CharacterId[];
	/** Always on the script, in play or not. */
	onScript?: CharacterId[];
	/** Rule characters (Fabled, Loric) always in the game. */
	ruleCharacters?: CharacterId[];
	/** A homebrew rule character the mode needs, by its own rules page (not in TPI data). */
	homebrew?: SourceLink[];
}

/** 8 and 9. Rules the Storyteller runs by hand: which characters, and where to read them. */
export interface LinkedRule extends Cited {
	characters: CharacterId[];
}

/** 10. Steps added to each day. */
export type DayStep = Cited &
	(
		| {
				kind: 'town-representative';
				/** Players the representative moves to the other town at the end of day N + 1. */
				movesPerDay: number[];
		  }
		| { kind: 'spectator-vote' }
	);

/** 11. How the game is won. */
export type WinRule = Cited &
	(
		| { kind: 'standard' }
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
	daySteps?: DayStep[];
	winConditions?: WinRule;
	towns?: TownsRule;
	participants?: ParticipantsRule;
	betweenGames?: BetweenGamesRule;
}

export interface GameMode {
	format: typeof GAME_MODE_FORMAT;
	/** Lower-case letters, digits and dashes; unique among modes. */
	id: string;
	/** The name its community uses. */
	name: string;
	/** Other names it goes by (searched, shown in Inspect). */
	aliases?: string[];
	/** Where its rules come from, the rules page first. Every mode credits its source. */
	sources: SourceLink[];
	/** People the source credits. */
	credits?: string[];
	/** Parts no source confirms; Inspect marks them. */
	unconfirmed?: ModePart[];
	parts: ModeParts;
}
