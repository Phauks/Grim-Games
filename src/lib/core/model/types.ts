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
import type { Alignment, CharacterId, Script } from '#lib/core/data/index.ts';
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

/**
 * A reminder token as TPI's data names it: the character it belongs to and its text,
 * e.g. `{ characterId: 'drunk', label: 'Is The Drunk' }` or `{ characterId: 'zombuul',
 * label: 'Dead' }`.
 */
export interface Reminder {
	characterId: CharacterId;
	label: string;
}

/** A reminder token placed in the grimoire. It belongs to a seat and moves with it. */
export interface ReminderInstance extends Reminder {
	reminderId: ReminderId;
}

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
 * How a player died, when the Storyteller recorded it: executed, killed by the Demon, a
 * character's ability (its id), or something else. Undefined means not recorded. The app
 * does not track day or night, so the cause is never inferred.
 */
export type DeathCause = 'execution' | 'demon' | 'other' | CharacterId;

/** The death causes that are not a character. */
export const GENERAL_DEATH_CAUSES = [
	'execution',
	'demon',
	'other'
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
	/** Travellers drawn from the bag get their alignment set when the draw is confirmed. */
	includeTravellers: boolean;
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
	/** Demon bluffs; more than one set when more than one player gets bluffs. */
	bluffs: CharacterId[][];
	bag?: Bag;
	/** The Storyteller's changes to the night order, applied in this order. */
	nightOrderOverrides: NightStepOverride[];
	/** The Storyteller's changes to the pre-day reminders, applied in this order. */
	dayReminderOverrides: DayReminderOverride[];
}
