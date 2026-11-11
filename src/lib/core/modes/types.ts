/**
 * Game modes: community formats that change fundamental parts of a game (Trevor,
 * 2026-10-17). A mode is plain data in this format, so the app can show every section of it
 * (Inspect) and anyone can write one: a mode lists only the setup sections it changes, and
 * every section it leaves out stays standard. Each section's shape, and so its type here, is
 * its spec in `setup-spec.ts`.
 */
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import type { CAMPAIGN_ENDS, LinkValue, SectionValue } from './setup-spec.ts';

/** Bumped when the format changes incompatibly; a file in another format doesn't load. */
export const GAME_MODE_FORMAT = 1;

/** A page a mode or one of its sections comes from. */
export type SourceLink = LinkValue;

/** Every part a mode can change, in the order Inspect shows them. */
export const MODE_SECTIONS = [
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
export type ModeSection = (typeof MODE_SECTIONS)[number];

/** Each section's value, as its spec reads it (`setup-spec.ts`). */
export type PoolRule = SectionValue<'pool'>;
export type Restrictions = SectionValue<'restricted'>;
export type CountsRule = SectionValue<'counts'>;
export type SetupModifiersRule = SectionValue<'setupModifiers'>;
export type AssignmentRule = SectionValue<'assignment'>;
export type DuplicatesRule = SectionValue<'duplicates'>;
export type ForcedRule = SectionValue<'forced'>;
export type LinkedRule = SectionValue<'ruleChanges'>[number];
export type BluffsRule = SectionValue<'bluffs'>;
export type DayStep = SectionValue<'daySteps'>[number];
export type WinRule = SectionValue<'winConditions'>;
export type TownsRule = SectionValue<'towns'>;
export type ParticipantsRule = SectionValue<'participants'>;
export type BetweenGamesRule = SectionValue<'betweenGames'>;
export type TravellersRule = SectionValue<'travellers'>;
export type SeatsRule = SectionValue<'seats'>;
export type DeathsRule = SectionValue<'deaths'>;

export type CampaignEnd = (typeof CAMPAIGN_ENDS)[number];

/**
 * Every section a file can set (Trevor, 2026-11-01: one format for game modes and special
 * rules), each optional: a section left out stays standard.
 */
export type ModeSetup = { -readonly [K in FileSection]?: SectionValue<K> };

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
	unconfirmed?: FileSection[];
	/** Modes and rules this one can't sensibly be played with; choosing both warns. */
	conflictsWith?: { modes?: string[]; rules?: string[] };
	setup: ModeSetup;
	/** What the mode does in play, as a rules block (`FileRules`). */
	rules?: FileRules;
}

/**
 * Special rules (Trevor, 2026-10-18: "Yes, split"): a game has one game mode, and any number
 * of special rules on top. Since 2026-11-01 (Trevor: one format, auto-labelled) both are one
 * format, and a file's parts say which it is (`fileKind`): one that sets a whole-game part
 * (`WHOLE_GAME_SECTIONS`, or a pool other than the script) is a game mode, any other a special
 * rule, so several rules can stack. The World Cup 2025 scripts carry their rule this way, as Bootlegger lines
 * (https://botc-script-viewer.sthom.kiwi/wc25/). Design:
 * /mnt/project-files/world-cup-rules/format-design.md.
 */
export const SPECIAL_RULE_FORMAT = 1;

/** The game mode parts a special rule may also set: the ones that add to a game. */
export const STACKING_SECTIONS = [
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
] as const satisfies readonly ModeSection[];
export type StackingSection = (typeof STACKING_SECTIONS)[number];

/** Parts only a special rule sets, in the order Inspect shows them. */
export const RULE_ONLY_SECTIONS = ['text', 'travellers', 'seats', 'deaths'] as const;
export type RuleOnlySection = (typeof RULE_ONLY_SECTIONS)[number];

/** Every part a special rule can set. */
export const RULE_SECTIONS = [...STACKING_SECTIONS, ...RULE_ONLY_SECTIONS] as const;
export type RuleSection = (typeof RULE_SECTIONS)[number];

/** Every part any file can set: the game mode parts, then the rule parts. */
export const FILE_SECTIONS = [...MODE_SECTIONS, ...RULE_ONLY_SECTIONS] as const;
export type FileSection = (typeof FILE_SECTIONS)[number];

/**
 * Parts that make a file a game mode: each sets up or deals the whole game, so a game has one
 * answer for it. A pool other than the script (or the script plus hidden characters) does too.
 */
export const WHOLE_GAME_SECTIONS = [
	'counts',
	'assignment',
	'towns',
	'betweenGames'
] as const satisfies readonly ModeSection[];
export type WholeGameSection = (typeof WHOLE_GAME_SECTIONS)[number];

/**
 * What a file does in play, as a rules block (M61e, Trevor 2026-11-06: "build modes from rule
 * parts"): the same parts a character's block has (`data/parts/`), read by the same reader, so
 * a mode or rule is a rule source like a Fabled or Loric (`rule-effects.ts`). Count changes are
 * `setupModifier`, who the Demon attacks `demonAttack.target`, who keeps an ability
 * `deadKeepAbilities`, extra night wakes `nightWakes`, and what a nomination sets off
 * `onNominated`.
 */
export type FileRules = CharacterRules;

/** A special rule's pool can only add to the script. */
export type RuleSetup = Omit<Pick<ModeSetup, RuleSection>, 'pool'> & {
	pool?: Extract<PoolRule, { kind: 'script-plus-hidden' }>;
};

/** A game mode with its special rules folded in (`combineRules`). */
export type CombinedSetup = ModeSetup;

export interface SpecialRule {
	/** Set by the parser from the file's parts (`fileKind`); a file need not say it. */
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
	unconfirmed?: RuleSection[];
	/** Modes and rules this one can't sensibly be played with; choosing both warns. */
	conflictsWith?: { modes?: string[]; rules?: string[] };
	setup: RuleSetup;
	/** What the rule does in play, as a rules block (`FileRules`). */
	rules?: FileRules;
}
