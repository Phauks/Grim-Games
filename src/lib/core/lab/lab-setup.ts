/**
 * The Character Lab's setup (plan M37, Trevor 2026-11-04: "load game and start game should be
 * the same"): what a Storyteller does between the draw and Start game, done for them so a lab
 * game opens on the first night. Each setup reminder the grimoire suggests goes on the seat
 * it names, or on one of the players who fit, picked at random.
 *
 * Everything here reads `setupReminders`, so a new character's setup tokens need no change.
 */
import type { CharacterLookup, Game, Reminder, SeatId } from '#lib/core/model/index.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import { setupReminders, type SetupReminder } from '#lib/core/rules/setup-reminders.ts';

export interface LabPlacement {
	seatId: SeatId;
	reminder: Reminder;
}

/** The most setup tokens one game places, so a suggestion that never clears can't loop. */
const MAX_PLACEMENTS = 64;

/**
 * Where a suggested setup reminder goes: its pre-filled seat, else a random player who fits,
 * else (no players listed: a token for the character's own seat) the seat that truly is it.
 */
export function labSeatFor(
	suggestion: SetupReminder,
	game: Game,
	characters: CharacterLookup,
	random: () => number = Math.random
): SeatId | undefined {
	if (suggestion.seatId) return suggestion.seatId;
	const { candidates } = suggestion;
	if (candidates.length) return candidates[Math.floor(random() * candidates.length)];
	return game.seating.find((id) => trueCharacter(game, id, characters) === suggestion.characterId);
}

/**
 * Places every setup reminder still suggested, one at a time (a token placed can change the
 * next suggestion), through `place`, which runs the command and returns the game after it.
 * A suggestion that stays after its token is placed, or has no seat, is passed over.
 */
export function placeLabSetup(
	start: Game,
	characters: CharacterLookup,
	place: (placement: LabPlacement) => Game,
	random: () => number = Math.random
): LabPlacement[] {
	const placed: LabPlacement[] = [];
	const passed = new Set<string>();
	let game = start;
	for (let n = 0; n < MAX_PLACEMENTS; n++) {
		const key = (s: SetupReminder) => `${s.characterId}:${s.label}`;
		const suggestions = setupReminders(game, characters);
		const next = suggestions.find((s) => !passed.has(key(s)));
		if (!next) break;
		const seatId = labSeatFor(next, game, characters, random);
		const before = suggestions.filter((s) => key(s) === key(next)).length;
		if (!seatId) {
			passed.add(key(next));
			continue;
		}
		const placement: LabPlacement = {
			seatId,
			reminder: {
				characterId: next.characterId,
				label: next.label,
				...(next.ownerSeatId ? { ownerSeatId: next.ownerSeatId } : {})
			}
		};
		game = place(placement);
		placed.push(placement);
		const after = setupReminders(game, characters).filter((s) => key(s) === key(next)).length;
		if (after >= before) passed.add(key(next));
	}
	return placed;
}
