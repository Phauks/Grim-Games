/**
 * Events: what happened, fully resolved. Events carry every id, time and random outcome,
 * so replaying the log rebuilds exactly the same game with no context at all.
 *
 * Saved games store events, so changing an event's shape needs a saved-game migration
 * (`#lib/core/engine/persistence.ts`).
 */
import type { Alignment, CharacterId, Script, PlayerName } from '#lib/core/data/index.ts';
import type { DayMark } from '#lib/core/data/day-mark-rules.ts';
import type { DayReminderOverride, NightStepOverride } from '#lib/core/rules/index.ts';
import type { AvatarId } from '#lib/core/avatars/index.ts';
import type { FrameId } from '#lib/core/frames/index.ts';
import type {
	DayEntry,
	DayEntryId,
	DeathCause,
	GameId,
	GameNote,
	GenericToken,
	OverrideField,
	Reminder,
	ReminderId,
	ReminderInstance,
	SeatId,
	SeatOverride,
	SymbolColour,
	Tile,
	TileId
} from '#lib/core/model/index.ts';

export type GameEvent =
	| { type: 'GameCreated'; gameId: GameId; createdAt: number; script: Script; seatIds: SeatId[] }
	/** Replaces `Game.script`; nothing else changes. */
	| { type: 'ScriptChanged'; script: Script }
	| { type: 'SeatAdded'; seatId: SeatId; position: number; playerName?: PlayerName }
	| { type: 'SeatRemoved'; seatId: SeatId }
	| { type: 'SeatRenamed'; seatId: SeatId; playerName?: PlayerName }
	/** No `note` clears it. */
	| { type: 'SeatNoteSet'; seatId: SeatId; note?: string }
	/** The seat's avatar and frame; a missing one clears it. */
	| { type: 'SeatLookSet'; seatId: SeatId; avatar?: AvatarId; frame?: FrameId }
	/**
	 * The single general note of games saved before 2026-10-23; replayed as the untitled
	 * note `n1`. No `notes` clears it. Never written now.
	 */
	| { type: 'GameNotesSet'; notes?: string }
	/** Adds or replaces the game note with `note.noteId`. */
	| { type: 'GameNoteSet'; note: GameNote }
	| { type: 'GameNoteDeleted'; noteId: string }
	/** No `alignment`: not chosen yet (a Traveller's), so the seat has none. */
	| { type: 'CharacterAssigned'; seatId: SeatId; characterId: CharacterId; alignment?: Alignment }
	| { type: 'CharacterCleared'; seatId: SeatId }
	| { type: 'AlignmentSet'; seatId: SeatId; alignment: Alignment }
	/** `cause` only with `dead: true`; `dead: false` clears any cause. */
	| { type: 'DeathSet'; seatId: SeatId; dead: boolean; cause?: DeathCause }
	/** No `cause` clears it. */
	| { type: 'DeathCauseSet'; seatId: SeatId; cause?: DeathCause }
	| { type: 'GhostVoteSpent'; seatId: SeatId }
	| { type: 'GhostVoteRestored'; seatId: SeatId }
	| { type: 'ReminderAdded'; seatId: SeatId; reminder: ReminderInstance }
	| { type: 'ReminderMoved'; reminderId: ReminderId; toSeatId: SeatId }
	| { type: 'ReminderRemoved'; reminderId: ReminderId }
	| { type: 'RuleReminderAdded'; characterId: CharacterId; reminder: ReminderInstance }
	| { type: 'ReminderMovedToRuleCharacter'; reminderId: ReminderId; characterId: CharacterId }
	| { type: 'LooseReminderPlaced'; reminder: ReminderInstance }
	| { type: 'ReminderLoosened'; reminderId: ReminderId }
	| { type: 'ReminderNoteSet'; reminderId: ReminderId; note?: string }
	| { type: 'ReminderSymbolSet'; reminderId: ReminderId; symbol?: string }
	| { type: 'ReminderSymbolColourSet'; reminderId: ReminderId; colour?: SymbolColour }
	/** Without `fill`, the symbol goes back to an outline. */
	| { type: 'ReminderSymbolFillSet'; reminderId: ReminderId; fill?: true }
	| { type: 'GenericTokenAdded'; token: GenericToken }
	/** Replaces the bank ∞ token with the same `tokenId`. */
	| { type: 'GenericTokenSet'; token: GenericToken }
	| { type: 'GenericTokenRemoved'; tokenId: string }
	| { type: 'StorytellerNameSet'; name?: string }
	| { type: 'SeatsSwapped'; seatA: SeatId; seatB: SeatId }
	/** The whole seating order, the same seats in a new order (RotateSeats, MoveSeat). */
	| { type: 'SeatingReordered'; seating: SeatId[] }
	| { type: 'OverrideSet'; seatId: SeatId; override: SeatOverride }
	| { type: 'OverrideCleared'; seatId: SeatId; field: OverrideField }
	| { type: 'NightStepOverrideAdded'; index: number; override: NightStepOverride }
	| { type: 'NightStepOverrideReplaced'; index: number; override: NightStepOverride }
	| { type: 'NightStepOverrideRemoved'; index: number }
	| { type: 'DayReminderOverrideAdded'; index: number; override: DayReminderOverride }
	| { type: 'DayReminderOverrideReplaced'; index: number; override: DayReminderOverride }
	| { type: 'DayReminderOverrideRemoved'; index: number }
	| { type: 'RuleCharacterAdded'; characterId: CharacterId }
	| { type: 'RuleCharacterRemoved'; characterId: CharacterId }
	| { type: 'BluffsSet'; set: number; characterIds: CharacterId[] }
	| { type: 'BluffSetRemoved'; set: number }
	| { type: 'BluffSetRenamed'; set: number; name: string }
	| {
			type: 'BagBuilt';
			tiles: Tile[];
			order: TileId[];
			includeTravellers: boolean;
			unseated?: Reminder[];
	  }
	| { type: 'BagCleared' }
	| { type: 'TileDrawn'; tileId: TileId; seatId: SeatId }
	| { type: 'DrawConfirmed'; tileId: TileId }
	/** The tile goes back into the bag at `position` in the draw order. */
	| { type: 'DrawCancelled'; tileId: TileId; position: number }
	/** A new entry at the end of today's log (its own effects are separate events). */
	| { type: 'DayEntryAdded'; entry: DayEntry }
	/** Replaces the entry with the same `entryId`. */
	| { type: 'DayEntryReplaced'; entry: DayEntry }
	| { type: 'DayEntryRemoved'; entryId: DayEntryId }
	/** No `value` clears the mark. */
	| { type: 'DayMarkSet'; mark: DayMark; value?: boolean }
	/** Version 3 to 17's Demon voted mark; replays as `DayMarkSet` for `demon-voted`. */
	| { type: 'DemonVotedSet'; voted?: boolean }
	/** No `value` clears it. */
	| { type: 'PrepValueSet'; key: string; value?: string }
	/** Today's log moves to `pastDays` and an empty one starts. */
	| { type: 'DayStarted'; at: number };

export type GameEventType = GameEvent['type'];
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
