/**
 * The game state a grimoire holds (04-architecture.md §3, as revised 2026-10-15).
 *
 * Game terms: a character has a *type* (townsfolk ... loric), a player has an *alignment*
 * (good/evil). A *seat* is a player wherever they sit; *seating* is the clockwise order.
 * Fabled and Loric are *rule characters* held on the game, never on a seat.
 *
 * State is only ever changed by the engine's reducer (`#lib/core/engine`), so these types
 * are plain, JSON-serialisable data.
 */
import type { Alignment, CharacterId, ReminderLabel, Script } from '#lib/core/data/index.ts';
// Type-only: the Storyteller's night-order and day-reminder overrides are defined next to
// the rules that apply them, and stored on the game.
import type { DayReminderOverride } from '#lib/core/rules/day-reminders.ts';
import type { NightStepOverride } from '#lib/core/rules/night-order.ts';

export type GameId = string;
export type SeatId = string;
/** Identifies one reminder token placed in the grimoire. */
export type ReminderId = string;
/** Identifies one tile in the bag. */
export type TileId = string;
/** Identifies one entry in a day log. */
export type DayEntryId = string;

/**
 * A reminder token as TPI's data names it: the character it belongs to and its text,
 * e.g. `{ characterId: 'drunk', label: 'Is The Drunk' }` or `{ characterId: 'zombuul',
 * label: 'Dead' }`.
 */
export interface Reminder {
	characterId: CharacterId;
	label: ReminderLabel;
}

/** A reminder token placed in the grimoire. It belongs to a seat and moves with it. */
export interface ReminderInstance extends Reminder {
	reminderId: ReminderId;
	/** The Storyteller's own words on it; only the generic ∞ reminder has one so far. */
	note?: string;
}

/**
 * The generic ∞ reminder's `characterId` (Trevor, 2026-10-18: one plain reminder, as many as
 * needed, with optional text, instead of a custom reminder). It belongs to no character.
 */
export const GENERIC_REMINDER_ID = 'generic';

/**
 * What a Storyteller override replaces. Overrides win over anything the rules conclude:
 * - `registersAsDead`: whether abilities treat the player as dead;
 * - `alignment`: the alignment the rules use for this player;
 * - `character`: the player's true character for the rules;
 * - `canDie`: whether the player can die (behaviours such as the Tea Lady ask this).
 */
export type SeatOverride =
	| { field: 'registersAsDead'; value: boolean; note?: string }
	| { field: 'alignment'; value: Alignment; note?: string }
	| { field: 'character'; value: CharacterId; note?: string }
	| { field: 'canDie'; value: boolean; note?: string };

export type OverrideField = SeatOverride['field'];
export const OVERRIDE_FIELDS = [
	'registersAsDead',
	'alignment',
	'character',
	'canDie'
] as const satisfies readonly OverrideField[];

/**
 * How a player died, when the Storyteller recorded it: executed, exiled (Travellers),
 * killed by the Demon, a character's ability (its id), or something else. Undefined means
 * not recorded. The app does not track day or night, so the cause is never inferred.
 * Exile is not an execution (https://wiki.bloodontheclocktower.com/Exile).
 */
export type DeathCause = 'execution' | 'exile' | 'demon' | 'other' | CharacterId;

/** The death causes that are not a character. */
export const GENERAL_DEATH_CAUSES = [
	'execution',
	'demon',
	'other',
	'exile'
] as const satisfies readonly DeathCause[];

/** A player, wherever they sit. */
export interface Seat {
	seatId: SeatId;
	playerName?: string;
	/** The character token in the grimoire for this player: what they were shown. */
	characterId?: CharacterId;
	/**
	 * Set whenever `characterId` is: defaulted from the character type, and always chosen
	 * by the Storyteller for a Traveller. Undefined only while the seat has no character.
	 */
	alignment?: Alignment;
	dead: boolean;
	/** How the player died, if the Storyteller recorded it. Only set while `dead`. */
	deathCause?: DeathCause;
	/** True once a dead player has used their vote. */
	ghostVoteUsed: boolean;
	/** At most one override per field. */
	overrides: SeatOverride[];
	/**
	 * The Storyteller's private note about this player (Trevor, 2026-10-16), e.g. the
	 * Mezepheles' word or the Amnesiac's ability. Never in the public projection.
	 */
	note?: string;
	reminders: ReminderInstance[];
}

/**
 * One tile in the bag. `shows` is the character the player sees when they draw it;
 * `grimoire` is the character token that goes in front of their seat in the grimoire.
 * The Drunk is a tile that shows a Townsfolk, puts that Townsfolk in the grimoire, and
 * places "Is The Drunk"; a Lunatic tile shows the Demon and puts the Lunatic in the
 * grimoire.
 */
export interface Tile {
	tileId: TileId;
	shows: CharacterId;
	grimoire: CharacterId;
	/** Reminder tokens placed on the drawing player's seat when the draw is confirmed. */
	reminders: Reminder[];
	/** Set while a player holds the tile (drawn) and after the draw is confirmed. */
	drawnBySeat?: SeatId;
	confirmed: boolean;
}

/** The bag is persisted, so backing out of the draw never loses it. */
export interface Bag {
	tiles: Record<TileId, Tile>;
	/** Tiles still in the bag, in draw order. */
	order: TileId[];
	/** Travellers drawn from the bag get their alignment when the draw is confirmed, or later. */
	includeTravellers: boolean;
	/**
	 * "Is The …" reminders for characters in play with no tile (the Drunk, the Marionette):
	 * the Storyteller puts them on a player once the tokens come back (Trevor, 2026-10-16).
	 * Absent in games saved before this existed, which is the same as none.
	 */
	unseated?: Reminder[];
}

/** A public guess of one player's character (the Juggler's, for example). */
export interface CharacterGuess {
	seatId: SeatId;
	characterId: CharacterId;
}

/**
 * One thing the Storyteller logged since the last "New day" (Trevor, 2026-10-15: the log is
 * cleared by hand, never by the night order, because the app does not track day or night):
 * - `nomination`: who nominated whom. Votes are not tracked; a player-facing vote tracker
 *   comes later.
 * - `execution`: the player was executed (and marked dead by execution if they were alive).
 * - `exile`: a Traveller was exiled (and marked dead by exile if alive). Exile is not an
 *   execution: abilities about executions ignore it
 *   (https://wiki.bloodontheclocktower.com/Exile).
 * - `ability`: a character used its ability; `reminderId` is the "No Ability" token placed.
 * - `note`: the Storyteller's free text about a character (a Gossip statement, the Artist's
 *   question, what the Savant was told), with structured `guesses` for the Juggler.
 * - `info`: what a waking character was shown, with the reminder tokens it placed, and
 *   whether it worked abnormally (for the Mathematician).
 */
export type DayEntry =
	| { kind: 'nomination'; entryId: DayEntryId; nominator: SeatId; nominee: SeatId }
	| { kind: 'execution'; entryId: DayEntryId; seatId: SeatId; died: boolean }
	| { kind: 'exile'; entryId: DayEntryId; seatId: SeatId; died: boolean }
	| {
			kind: 'ability';
			entryId: DayEntryId;
			seatId: SeatId;
			characterId: CharacterId;
			reminderId?: ReminderId;
	  }
	| {
			kind: 'note';
			entryId: DayEntryId;
			characterId: CharacterId;
			seatId?: SeatId;
			text: string;
			guesses?: CharacterGuess[];
	  }
	| {
			kind: 'info';
			entryId: DayEntryId;
			seatId: SeatId;
			characterId: CharacterId;
			text: string;
			reminderIds: ReminderId[];
			/** Set when the info or ability worked abnormally because of another character. */
			abnormal?: AbnormalCause[];
	  };

export type DayEntryKind = DayEntry['kind'];

/**
 * Why an ability worked abnormally, for the Mathematician
 * (https://wiki.bloodontheclocktower.com/Mathematician): the player was drunk or poisoned or
 * had no ability, a Vortox made the info false, a player registered as something else, a
 * protection stopped a death, or something else the Storyteller noted. `characterId` and
 * `seatId` name the other character responsible, when known.
 */
export type AbnormalReason =
	'drunk' | 'poisoned' | 'no-ability' | 'vortox' | 'registration' | 'protected' | 'other';

export const ABNORMAL_REASONS = [
	'drunk',
	'poisoned',
	'no-ability',
	'vortox',
	'registration',
	'protected',
	'other'
] as const satisfies readonly AbnormalReason[];

export interface AbnormalCause {
	reason: AbnormalReason;
	characterId?: CharacterId;
	seatId?: SeatId;
}

/** The day log: everything logged since the last "New day". */
export interface DayLog {
	entries: DayEntry[];
	/**
	 * Whether the Demon voted, as the Storyteller marked it (for the Flowergirl). Undefined
	 * until marked. Votes themselves are not tracked.
	 */
	demonVoted?: boolean;
	/** When "New day" closed this log (milliseconds since the epoch); only on past days. */
	closedAt?: number;
}

export interface Game {
	gameId: GameId;
	/** Milliseconds since the epoch. */
	createdAt: number;
	script: Script;
	seats: Record<SeatId, Seat>;
	/** Clockwise seating order. Swapping seats (the Matron) reorders this only. */
	seating: SeatId[];
	/** Fabled and Loric in play. */
	ruleCharacters: CharacterId[];
	/**
	 * Reminders held by a Fabled or Loric in play, by its id (Trevor, 2026-10-17). Optional,
	 * so older saved games read as before; removing the character takes its reminders away.
	 */
	ruleReminders?: Record<CharacterId, ReminderInstance[]>;
	/**
	 * Reminders on the board that belong to no seat (Trevor, 2026-10-17: a reminder put down
	 * anywhere "would not be assigned to a character, because we wouldn't be able to tell who
	 * had it"). Where each one sits is the device's own; optional, so older games read as before.
	 */
	looseReminders?: ReminderInstance[];
	/** Demon bluffs; more than one set when more than one player gets bluffs. */
	bluffs: CharacterId[][];
	/**
	 * Names the Storyteller gave bluff sets, by position (Trevor, 2026-10-17); an empty or
	 * missing name means the set's default. Optional, so older saved games read as before.
	 */
	bluffNames?: string[];
	bag?: Bag;
	/** The Storyteller's changes to the night order, applied in this order. */
	nightOrderOverrides: NightStepOverride[];
	/** The Storyteller's changes to the pre-day reminders, applied in this order. */
	dayReminderOverrides: DayReminderOverride[];
	/**
	 * Values the Storyteller chose during prep, by `prepValueKey` ("yaggababble.phrase").
	 * Private: never in the public projection. Absent until one is set.
	 */
	prepValues?: Record<string, string>;
	/** The current day log, since the last "New day". */
	today: DayLog;
	/** Earlier day logs, oldest first, closed by "New day". */
	pastDays: DayLog[];
}
