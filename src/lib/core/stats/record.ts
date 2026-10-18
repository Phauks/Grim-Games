/**
 * Game records: what one finished game leaves behind for History and its stats (Trevor,
 * 2026-10-16). A record is plain JSON, so it can later be kept in a signed-in profile and
 * merged across devices by `gameId`; today records are worked out from the games saved on
 * this device whenever History opens (`deriveGameRecord`).
 *
 * Days follow the grimoire's own count (`dayNumber`): 0 is the first night, and each Dawn
 * starts the next day.
 */
import type { Alignment, CharacterId, CharacterName, CharacterType } from '#lib/core/data/index.ts';
import type { DeathCause, GameId, SeatId } from '#lib/core/model/index.ts';
import type { EndReason } from '#lib/core/rules/end-reason.ts';

/** Bump when the record's shape changes, as with saved games, once records are stored. */
export const GAME_RECORD_VERSION = 1;

/**
 * Who kept the record: the Storyteller who ran the game, or (once sign-in can bring in
 * games from other Storytellers) a player in it.
 */
export type RecordRole = 'storyteller' | 'player';

/** A player's true character and the alignment the rules used, at one moment. */
export interface RecordCharacter {
	characterId: CharacterId;
	alignment?: Alignment;
}

export interface RecordSeat {
	seatId: SeatId;
	playerName?: string;
	/** At the first Dawn (the end of the first night); absent if the seat had no character then. */
	start?: RecordCharacter;
	/** When the game ended. */
	end?: RecordCharacter;
	dead: boolean;
	deathCause?: DeathCause;
	/** The day the player last died on, by the grimoire's count (0 is the first night). */
	diedOnDay?: number;
}

/** One day's log, as the Storyteller kept it. */
export interface RecordDay {
	day: number;
	nominations: number;
	executed: SeatId[];
	exiled: SeatId[];
}

export interface GameRecord {
	recordVersion: typeof GAME_RECORD_VERSION;
	gameId: GameId;
	role: RecordRole;
	/** Milliseconds since the epoch. */
	createdAt: number;
	endedAt: number;
	script: { name?: string; author?: string };
	/** Absent when the Storyteller did not record it. */
	winner?: Alignment;
	/**
	 * How it was won: what End game saved, else what the grimoire shows (`detectedEndReason`).
	 * Absent when no winner was recorded.
	 */
	endReason?: EndReason;
	/**
	 * Whether exactly 3 players were alive at some point after the first Dawn, not counting
	 * Travellers (the final 3 before the "just 2 alive" end).
	 */
	finalThree: boolean;
	/** The day the game ended on (0 if it ended during the first night). */
	days: number;
	/** In seating order at the end. */
	seats: RecordSeat[];
	/** Fabled and Loric in play at the end. */
	ruleCharacters: CharacterId[];
	dayLog: RecordDay[];
	/**
	 * Name and type of every character the record mentions, so a record reads without the
	 * script that defined a homebrew character.
	 */
	characters: Record<CharacterId, { name: CharacterName; type: CharacterType }>;
}
