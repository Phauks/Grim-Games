/**
 * Commands: everything the Storyteller can do to a game (04-architecture.md §3). A
 * command is checked against the current game and turned into events; it never changes
 * state itself.
 */
import type { Alignment, CharacterId, Script } from '#lib/core/data/index.ts';
import type { DayReminderOverride, NightStepOverride } from '#lib/core/rules/index.ts';
import type {
	AbnormalCause,
	CharacterGuess,
	DayEntryId,
	DeathCause,
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
	/**
	 * Marks a player dead or alive. `cause` is optional when marking dead (the Storyteller
	 * can skip it and set it later with `SetDeathCause`); on an already dead player it sets
	 * the cause. Coming back to life clears the cause.
	 */
	| { type: 'SetDead'; seatId: SeatId; dead: boolean; cause?: DeathCause }
	/** Records how a dead player died; an undefined `cause` clears it. */
	| { type: 'SetDeathCause'; seatId: SeatId; cause?: DeathCause }
	| { type: 'SpendGhostVote'; seatId: SeatId }
	| { type: 'RestoreGhostVote'; seatId: SeatId }
	| { type: 'AddReminder'; seatId: SeatId; reminder: Reminder }
	| { type: 'MoveReminder'; reminderId: ReminderId; toSeatId: SeatId }
	| { type: 'RemoveReminder'; reminderId: ReminderId }
	/**
	 * Places several reminders at once, such as the suggested setup reminders
	 * (`setupReminders`, `placeableSetupReminders`). Each becomes a normal reminder that can
	 * be moved or removed; undo takes them all back in one step.
	 */
	| { type: 'ApplySetupReminders'; placements: { seatId: SeatId; reminder: Reminder }[] }
	/** Swaps two players' places in the seating order (the Matron). */
	| { type: 'SwapSeats'; seatA: SeatId; seatB: SeatId }
	| { type: 'SetOverride'; seatId: SeatId; override: SeatOverride }
	| { type: 'ClearOverride'; seatId: SeatId; field: OverrideField }
	/**
	 * The Storyteller's night-order overrides, kept in the order they apply. `index` is the
	 * 0-based place in `Game.nightOrderOverrides`; `Add` appends unless `index` is given.
	 */
	| { type: 'AddNightStepOverride'; override: NightStepOverride; index?: number }
	| { type: 'ReplaceNightStepOverride'; index: number; override: NightStepOverride }
	| { type: 'RemoveNightStepOverride'; index: number }
	/** The same for the pre-day reminders (`Game.dayReminderOverrides`). */
	| { type: 'AddDayReminderOverride'; override: DayReminderOverride; index?: number }
	| { type: 'ReplaceDayReminderOverride'; index: number; override: DayReminderOverride }
	| { type: 'RemoveDayReminderOverride'; index: number }
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
	| { type: 'CancelDraw'; tileId: TileId }
	// ── The day log (`Game.today`). Every entry can be removed or edited: an override. ──
	/** Logs a nomination: who nominated whom. Votes are not tracked. */
	| { type: 'Nominate'; nominator: SeatId; nominee: SeatId }
	/** Changes who nominated whom in a logged nomination. */
	| { type: 'EditNomination'; entryId: DayEntryId; nominator: SeatId; nominee: SeatId }
	/** Marks whether the Demon voted today (for the Flowergirl); undefined clears it. */
	| { type: 'SetDemonVoted'; voted?: boolean }
	/**
	 * Stores a value the Storyteller chose during prep (the Yaggababble's secret phrase) as
	 * `Game.prepValues[key]`, `key` from `prepValueKey`; no `value` or an empty one clears it.
	 */
	| { type: 'SetPrepValue'; key: string; value?: string }
	/** Logs an execution and marks the player dead by execution, if alive. */
	| { type: 'Execute'; seatId: SeatId }
	/**
	 * Logs that a character used its ability. A character with a "No Ability" reminder
	 * token gets it placed on the seat; otherwise only the use is logged.
	 */
	| { type: 'UseAbility'; seatId: SeatId; characterId: CharacterId }
	/** A free-text note about a character (any length; may be empty with `guesses`). */
	| {
			type: 'DayNote';
			characterId: CharacterId;
			seatId?: SeatId;
			text: string;
			guesses?: CharacterGuess[];
	  }
	/** Replaces a note's text and guesses (no `guesses` clears them). */
	| { type: 'EditDayNote'; entryId: DayEntryId; text: string; guesses?: CharacterGuess[] }
	/**
	 * Records what a waking character was shown (`seatId` is the waking player), placing
	 * reminder tokens such as the Washerwoman's "Townsfolk" and "Wrong". A later record for
	 * the same seat and character is what the night order shows: the Storyteller's override.
	 */
	| {
			type: 'RecordNightInfo';
			seatId: SeatId;
			characterId: CharacterId;
			text: string;
			reminders?: { seatId: SeatId; reminder: Reminder }[];
			/** The info or ability worked abnormally because of these (see `abnormalCauses`). */
			abnormal?: AbnormalCause[];
	  }
	/**
	 * Removes a day-log entry and undoes what it did to the grimoire: an execution's death
	 * (if still dead by execution) and the reminder tokens an ability use or night info placed
	 * (if still there).
	 */
	| { type: 'RemoveDayEntry'; entryId: DayEntryId }
	/**
	 * Closes the day log and starts an empty one; the old one is kept as history. The
	 * Storyteller does this by hand ("New day"); opening the night order never does.
	 */
	| { type: 'NewDay' };

export type CommandType = Command['type'];
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;
