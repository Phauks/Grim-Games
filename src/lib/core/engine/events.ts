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
	FakeEvilInfo,
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
	| {
			type: 'SeatAdded';
			seatId: SeatId;
			position: number;
			playerName?: PlayerName;
			notInPlay?: true;
	  }
	| { type: 'SeatInPlaySet'; seatId: SeatId; inPlay: boolean }
	| { type: 'SeatRemoved'; seatId: SeatId }
	| { type: 'SeatRenamed'; seatId: SeatId; playerName?: PlayerName }
	/**
	 * The single note on a seat of games saved before 2026-10-26; replayed as the seat's
	 * untitled note `n1`. No `note` clears it. Never written now.
	 */
	| { type: 'SeatNoteSet'; seatId: SeatId; note?: string }
	/** Adds or replaces the seat's note with `note.noteId`. */
	| { type: 'SeatNoteSaved'; seatId: SeatId; note: GameNote }
	| { type: 'SeatNoteDeleted'; seatId: SeatId; noteId: string }
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
	/** Sets (or, without `characterId`, takes away) the ability `via` gives this player. */
	| { type: 'HeldAbilitySet'; seatId: SeatId; via: CharacterId; characterId?: CharacterId }
	/** Sets (or, without `characterId`, takes away) the ability `via` gives the Storyteller. */
	| { type: 'StorytellerAbilitySet'; via: CharacterId; characterId?: CharacterId }
	/** Joins `Game.reincarnated`; the character and life come from the events before it. */
	| { type: 'SeatReincarnated'; seatId: SeatId }
	| { type: 'OptionalRuleSet'; characterId: CharacterId; on: boolean }
	/** `cause` only with `dead: true`; `dead: false` clears any cause. */
	/** `impaired`: their ability was not working as they died (drunk or poisoned). */
	| { type: 'DeathSet'; seatId: SeatId; dead: boolean; cause?: DeathCause; impaired?: true }
	/** No `cause` clears it. */
	| { type: 'DeathCauseSet'; seatId: SeatId; cause?: DeathCause }
	| { type: 'GhostVoteSpent'; seatId: SeatId }
	| { type: 'GhostVoteRestored'; seatId: SeatId }
	/** The vote tokens a player holds (`Seat.voteTokens`); 0 clears it. */
	| { type: 'VoteTokensSet'; seatId: SeatId; count: number }
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
	/** No `info` clears it. */
	| { type: 'FakeEvilInfoSet'; seatId: SeatId; info?: FakeEvilInfo }
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
	/** A tile now shows and puts in the grimoire other characters (a late player joined). */
	| {
			type: 'TileRecast';
			tileId: TileId;
			shows: CharacterId;
			grimoire: CharacterId;
			reminders: Reminder[];
	  }
	/** A new tile goes into the bag at `position` in the draw order. */
	| { type: 'TileAdded'; tile: Tile; position: number }
	/** A tile still in the bag leaves the game. */
	| { type: 'TileRemoved'; tileId: TileId }
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
