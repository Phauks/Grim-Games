/**
 * A player's grim as a Game (Trevor, 2026-11-10: Local Grim should mark seats for the
 * reminder in hand as the Storyteller's board does): each seat with the character the grim
 * shows on it (a Traveller, the player's own or their guess) and that character's starting
 * alignment, so the board's reminder rules can read it. Nothing else of a game is known.
 */
import { defaultAlignment, type CharacterId, type Script } from '#lib/core/data/index.ts';
import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';

export interface TownSeat {
	seatId: SeatId;
	/** The character the grim shows on the seat, if any. */
	characterId?: CharacterId;
	dead?: boolean;
}

export function townGame(
	script: Script,
	seats: readonly TownSeat[],
	characters: CharacterLookup
): Game {
	return {
		gameId: 'town',
		createdAt: 0,
		script,
		seats: Object.fromEntries(
			seats.map(({ seatId, characterId, dead }) => {
				const type = characterId === undefined ? undefined : characters.get(characterId)?.type;
				return [
					seatId,
					{
						seatId,
						characterId,
						alignment: type === undefined ? undefined : defaultAlignment(type),
						dead: !!dead,
						ghostVoteUsed: false,
						overrides: [],
						reminders: []
					}
				];
			})
		),
		seating: seats.map((s) => s.seatId),
		ruleCharacters: [],
		bluffs: [],
		nightOrderOverrides: [],
		dayReminderOverrides: [],
		today: { entries: [] },
		pastDays: []
	};
}
