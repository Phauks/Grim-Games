/**
 * Commands: everything the Storyteller can do to a game (04-architecture.md §3). A
 * command is checked against the current game and turned into events; it never changes
 * state itself.
 */
import type { Alignment, CharacterId, Script } from '#lib/core/data/index.ts';
import type {
	OverrideField,
	Reminder,
	ReminderId,
	SeatId,
	SeatOverride,
	TileId
} from '#lib/core/model/index.ts';

/** A tile to put in the bag (see `Tile`). */
export interface TileSpec {
	shows: CharacterId;
	grimoire: CharacterId;
	reminders?: Reminder[];
}

export type Command =
	| { type: 'CreateGame'; script: Script; playerCount: number }
	/** `position` is the 0-based place in the seating order; the default is the end. */
	| { type: 'AddSeat'; playerName?: string; position?: number }
	| { type: 'RemoveSeat'; seatId: SeatId }
	/** An empty or missing name clears it. */
	| { type: 'RenameSeat'; seatId: SeatId; playerName?: string }
	/**
	 * Puts a character token on a seat. Without `alignment`, an empty seat takes the
	 * default for the character type and a seat that had a character keeps its alignment
	 * (a character change does not change alignment). A Traveller needs `alignment`
	 * unless the seat already has one.
	 */
	| { type: 'AssignCharacter'; seatId: SeatId; characterId: CharacterId; alignment?: Alignment }
	| { type: 'ClearCharacter'; seatId: SeatId }
	| { type: 'SetAlignment'; seatId: SeatId; alignment: Alignment }
	| { type: 'SetDead'; seatId: SeatId; dead: boolean }
	| { type: 'SpendGhostVote'; seatId: SeatId }
	| { type: 'RestoreGhostVote'; seatId: SeatId }
	| { type: 'AddReminder'; seatId: SeatId; reminder: Reminder }
	| { type: 'MoveReminder'; reminderId: ReminderId; toSeatId: SeatId }
	| { type: 'RemoveReminder'; reminderId: ReminderId }
	/** Swaps two players' places in the seating order (the Matron). */
	| { type: 'SwapSeats'; seatA: SeatId; seatB: SeatId }
	| { type: 'SetOverride'; seatId: SeatId; override: SeatOverride }
	| { type: 'ClearOverride'; seatId: SeatId; field: OverrideField }
	/** Fabled and Loric only. */
	| { type: 'AddRuleCharacter'; characterId: CharacterId }
	| { type: 'RemoveRuleCharacter'; characterId: CharacterId }
	/** Replaces bluff set `set` (0-based); `set` equal to the number of sets adds one. */
	| { type: 'SetBluffs'; set: number; characterIds: CharacterId[] }
	| { type: 'RemoveBluffSet'; set: number }
	/** Replaces the bag. Tiles are shuffled unless `shuffle` is false. */
	| { type: 'BuildBag'; tiles: TileSpec[]; includeTravellers: boolean; shuffle?: boolean }
	| { type: 'ClearBag' }
	/** A player takes a tile: `tileId` when they picked one, otherwise the next in order. */
	| { type: 'DrawTile'; seatId: SeatId; tileId?: TileId }
	/**
	 * The player has seen their tile: its grimoire character and reminders go on their
	 * seat. A Traveller tile needs `alignment`.
	 */
	| { type: 'ConfirmDraw'; tileId: TileId; alignment?: Alignment }
	/** The player puts the tile back; it returns to a random place in the bag. */
	| { type: 'CancelDraw'; tileId: TileId };

export type CommandType = Command['type'];
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;
