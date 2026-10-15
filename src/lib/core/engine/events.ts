/**
 * Events: what happened, fully resolved. Events carry every id, time and random outcome,
 * so replaying the log rebuilds exactly the same game with no context at all.
 *
 * Saved games store events, so changing an event's shape needs a saved-game migration
 * (`#lib/core/engine/persistence.ts`).
 */
import type { Alignment, CharacterId, Script } from '#lib/core/data/index.ts';
import type {
	GameId,
	OverrideField,
	ReminderId,
	ReminderInstance,
	SeatId,
	SeatOverride,
	Tile,
	TileId
} from '#lib/core/model/index.ts';

export type GameEvent =
	| { type: 'GameCreated'; gameId: GameId; createdAt: number; script: Script; seatIds: SeatId[] }
	| { type: 'SeatAdded'; seatId: SeatId; position: number; playerName?: string }
	| { type: 'SeatRemoved'; seatId: SeatId }
	| { type: 'SeatRenamed'; seatId: SeatId; playerName?: string }
	| { type: 'CharacterAssigned'; seatId: SeatId; characterId: CharacterId; alignment: Alignment }
	| { type: 'CharacterCleared'; seatId: SeatId }
	| { type: 'AlignmentSet'; seatId: SeatId; alignment: Alignment }
	| { type: 'DeathSet'; seatId: SeatId; dead: boolean }
	| { type: 'GhostVoteSpent'; seatId: SeatId }
	| { type: 'GhostVoteRestored'; seatId: SeatId }
	| { type: 'ReminderAdded'; seatId: SeatId; reminder: ReminderInstance }
	| { type: 'ReminderMoved'; reminderId: ReminderId; toSeatId: SeatId }
	| { type: 'ReminderRemoved'; reminderId: ReminderId }
	| { type: 'SeatsSwapped'; seatA: SeatId; seatB: SeatId }
	| { type: 'OverrideSet'; seatId: SeatId; override: SeatOverride }
	| { type: 'OverrideCleared'; seatId: SeatId; field: OverrideField }
	| { type: 'RuleCharacterAdded'; characterId: CharacterId }
	| { type: 'RuleCharacterRemoved'; characterId: CharacterId }
	| { type: 'BluffsSet'; set: number; characterIds: CharacterId[] }
	| { type: 'BluffSetRemoved'; set: number }
	| { type: 'BagBuilt'; tiles: Tile[]; order: TileId[]; includeTravellers: boolean }
	| { type: 'BagCleared' }
	| { type: 'TileDrawn'; tileId: TileId; seatId: SeatId }
	| { type: 'DrawConfirmed'; tileId: TileId }
	/** The tile goes back into the bag at `position` in the draw order. */
	| { type: 'DrawCancelled'; tileId: TileId; position: number };

export type GameEventType = GameEvent['type'];
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
