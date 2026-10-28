/**
 * Achievements (plan A1, Trevor 2026-10-27): what a player earns from the games they took
 * part in, and what it unlocks. Every reward is part of a laurel worn round their avatar and
 * seat token; each kind of achievement unlocks a different part (form, colour, medallion,
 * crest, accent, motion), and points buy parts too, so a repeat game still counts.
 *
 * No achievement may need a player to do something in a game (Trevor, 2026-10-27): criteria
 * read only the characters and alignments a player was given (every one they held, not just
 * the first), whether their team won, and facts about the whole game; never what their seat
 * did (nominations, votes, claims, ability uses, their own death). That is kept by the shape
 * of `Criteria` itself: there is no way to write such a rule. A win may earn an achievement
 * (Trevor: "won a game as a character type" for motion items), never points.
 *
 * Achievements are data, like character rules: the real list comes later, as each reward is
 * agreed. Design: https://claude.ai/artifact/3xwEgmAXm32oPVN6EMWUdL
 */
import type { CharacterId, CharacterType } from '#lib/core/data/index.ts';
import type { EndReason } from '#lib/core/rules/end-reason.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { GameRecord } from '#lib/core/stats/index.ts';

/** The parts of a laurel; each is one choice from the options a player holds. */
export const LAUREL_PARTS = ['form', 'colour', 'medallion', 'crest', 'accent', 'motion'] as const;
export type LaurelPart = (typeof LAUREL_PARTS)[number];

/** One option of one part, such as the form `olive` or the medallion `character:empath`. */
export interface LaurelOption {
	part: LaurelPart;
	option: string;
}

/** Facts about a whole game; every one given must hold. */
export interface GameFacts {
	/** A Fabled or Loric in play at the end. */
	ruleCharacter?: CharacterId;
	/** A character any seat had, at the first Dawn or at the end. */
	characterInPlay?: CharacterId;
	endReason?: EndReason;
	/** Exactly 3 players alive at some point (`GameRecord.finalThree`). */
	finalThree?: true;
	/** Players, not counting Travellers, at least this many. */
	minPlayers?: number;
	/** The game reached at least this day (0 is the first night). */
	minDays?: number;
}

export type Criteria =
	/** The player's own seat had this character at any point from the first Dawn. */
	| { kind: 'playedAs'; character: CharacterId }
	/** The seat had a character of this type at any point; with `won`, and its team won. */
	| { kind: 'playedType'; type: CharacterType; won?: true }
	/** Something changed the seat's character, or its alignment, during the game. */
	| { kind: 'changed'; what: 'character' | 'alignment' }
	/** The player took part in a game where these facts held. */
	| { kind: 'inGame'; where: GameFacts }
	/** This many games, optionally only those where the facts held. */
	| { kind: 'gamesPlayed'; count: number; as?: 'player' | 'storyteller'; where?: GameFacts };

export interface Achievement {
	id: string;
	criteria: Criteria;
	unlocks: LaurelOption[];
}

/**
 * One finished game as this person took part in it: the record, and their own seat when they
 * played (none when they were the Storyteller).
 */
export interface TakenPart {
	record: GameRecord;
	seatId?: SeatId;
}

export interface Earned {
	id: string;
	/** When the game that earned it ended (milliseconds since the epoch). */
	earnedAt: number;
}
