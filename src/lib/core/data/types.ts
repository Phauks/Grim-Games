/**
 * Character data as published by The Pandemonium Institute in botc-release
 * (`resources/data/*.json`, `script-schema.json`), in the game's own terms.
 *
 * The one rename: TPI's files call the character type `team`; here it is `type`, because
 * alignment (good/evil) is the team (04-architecture.md §3).
 */
import type { CharacterRules } from './character-rules.ts';

/** Character types, in TPI's order (`script-schema.json` → `team.enum`). */
export const CHARACTER_TYPES = [
	'townsfolk',
	'outsider',
	'minion',
	'demon',
	'traveller',
	'fabled',
	'loric'
] as const;
export type CharacterType = (typeof CHARACTER_TYPES)[number];

/** The character types dealt from the bag. */
export const SEATED_TYPES = ['townsfolk', 'outsider', 'minion', 'demon'] as const;
export type SeatedType = (typeof SEATED_TYPES)[number];

export const ALIGNMENTS = ['good', 'evil'] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

export type CharacterId = string;

/*
 * Character names and reminder token texts are marked so the `grim/names-as-badges` lint
 * can tell them from other strings: wherever one reaches the screen it must be a
 * CharacterBadge or ReminderToken, never plain text (Trevor, 2026-10-16). The marks are
 * type-only (no runtime cost) and optional, so any string still fits either way.
 */
declare const characterNameMark: unique symbol;
declare const reminderLabelMark: unique symbol;
/** Marks a character name; the lint looks for this interface by name. */
export interface CharacterNameMark {
	readonly [characterNameMark]?: true;
}
/** Marks a reminder token text; the lint looks for this interface by name. */
export interface ReminderLabelMark {
	readonly [reminderLabelMark]?: true;
}
/** A character's name, e.g. "Imp". Shown as a CharacterBadge. */
export type CharacterName = string & CharacterNameMark;
/** A reminder token's text, e.g. "Is The Drunk". Shown as a ReminderToken. */
export type ReminderLabel = string & ReminderLabelMark;

/** `special` vocabulary from `script-schema.json` (botc-release README, "special"). */
export const SPECIAL_TYPES = [
	'selection',
	'ability',
	'signal',
	'vote',
	'reveal',
	'player',
	'reminder'
] as const;
export type SpecialType = (typeof SPECIAL_TYPES)[number];

export const SPECIAL_NAMES = [
	'grimoire',
	'pointing',
	'ghost-votes',
	'distribute-roles',
	'bag-disabled',
	'bag-duplicate',
	'evil-duplicate',
	'good-duplicate',
	'multiplier',
	'hidden',
	'replace-character',
	'player',
	'card',
	'open-eyes',
	'public'
] as const;
export type SpecialName = (typeof SPECIAL_NAMES)[number];

export const SPECIAL_TIMES = [
	'pregame',
	'day',
	'night',
	'firstNight',
	'firstDay',
	'otherNight',
	'otherDay'
] as const;
export type SpecialTime = (typeof SPECIAL_TIMES)[number];

export const SPECIAL_GLOBALS = [
	'townsfolk',
	'outsider',
	'minion',
	'demon',
	'traveller',
	'dead'
] as const;
export type SpecialGlobal = (typeof SPECIAL_GLOBALS)[number];

/** A hook describing app behaviour a character needs (bag rules, vote changes, reveals...). */
export interface Special {
	type: SpecialType;
	name: SpecialName;
	value?: string | number;
	time?: SpecialTime;
	global?: SpecialGlobal;
}

export interface Character {
	id: CharacterId;
	name: CharacterName;
	type: CharacterType;
	/** Edition id, e.g. `tb`, `bmr`, `snv`, `carousel`, `fabled`, `loric`. Optional in custom scripts. */
	edition?: string;
	ability: string;
	flavor?: string;
	/** True when the character changes setup (bracketed ability text). */
	setup: boolean;
	/** Reminder tokens placed by this character. Duplicates are meaningful (two of a token). */
	reminders: ReminderLabel[];
	/** Reminder tokens available whenever the character is on the script, even if not in play. */
	remindersGlobal: ReminderLabel[];
	/** Storyteller text for the first night; absent when the character does not act then. */
	firstNightReminder?: string;
	/** Storyteller text for other nights; absent when the character does not act then. */
	otherNightReminder?: string;
	special: Special[];
	/** Only from custom scripts: icon URL(s). Official characters use the synced icons. */
	image?: string | string[];
	/** Only from custom scripts: numeric night positions (TPI's script format). */
	firstNight?: number;
	otherNight?: number;
	/**
	 * Only from custom scripts: the character's rules block (`character-rules.ts`). Official
	 * characters' blocks are our overlay files, read with `rulesOf`.
	 */
	rules?: CharacterRules;
}

/** One jinx between two characters, in the order TPI lists them (`jinxes.json`). */
export interface Jinx {
	characters: readonly [CharacterId, CharacterId];
	reason: string;
}

/** Night sheet steps that are not characters (`nightsheet.json`). */
export const NIGHT_MARKERS = ['dusk', 'minioninfo', 'demoninfo', 'dawn'] as const;
export type NightMarker = (typeof NIGHT_MARKERS)[number];

/** Official night order: position in the list is the order; there are no numbers. */
export interface NightSheet {
	firstNight: (CharacterId | NightMarker)[];
	otherNight: (CharacterId | NightMarker)[];
}

/** The `_meta` entry of a script (`script-schema.json`). */
export interface ScriptMeta {
	name: string;
	author?: string;
	/**
	 * The script's own version, such as "1.2". Not in TPI's schema (which allows extra keys);
	 * written by the Script builder (Trevor, 2026-10-18).
	 */
	version?: string;
	logo?: string;
	hideTitle?: boolean;
	background?: string;
	almanac?: string;
	/** Bootlegger homebrew rules, one per entry. */
	bootlegger?: string[];
	/** Custom night order for this script (ids and night markers). */
	firstNight?: string[];
	otherNight?: string[];
}

/**
 * A parsed script. Official characters are listed by id; characters defined in the
 * script itself (homebrew) carry their full data.
 */
export interface Script {
	meta?: ScriptMeta;
	entries: ScriptEntry[];
	/** Jinxes declared by homebrew characters on this script. Absent means none. */
	jinxes?: Jinx[];
}

export type ScriptEntry =
	{ kind: 'official'; id: CharacterId } | { kind: 'custom'; character: Character };
