/**
 * Which reminders just placed should ask a question (ReminderAsk.svelte). A reminder whose
 * words change a player's state asks to change it: "Dead" on a living player asks to mark them
 * dead, "Alive" on a dead one asks to revive them (reminderPrompt). A reminder of a character
 * whose player is dead asks before it is placed (Trevor, 2026-10-20). An ∞ token asks by the
 * words on it, as the reminder it copies when it is a copy (a Vortox "Dead" dropped on
 * "+ New token"), so a token that reads "Dead" always asks (M21, Trevor 2026-11-02).
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type {
	CharacterLookup,
	Game,
	ReminderId,
	ReminderInstance,
	SeatId
} from '#lib/core/model/index.ts';
import { reminderDeathCause } from '#lib/core/rules/death-causes.ts';
import {
	promptApplies,
	reminderOwnerDead,
	reminderPrompt,
	type ReminderPrompt
} from '#lib/core/rules/index.ts';
import { reminderWords } from './reminders.ts';

/** Asks to change a seat's state; `cause` is the reminder's character when it can kill. */
export interface PromptAsk {
	seatId: SeatId;
	prompt: ReminderPrompt;
	cause?: CharacterId;
}

/** Asks before placing a dead player's reminder; `from` is the seat it was moved from. */
export interface DeadAsk {
	reminder: ReminderInstance;
	seatId: SeatId;
	from?: SeatId;
}

/** What the board looked like at the last look: each reminder at its seat. */
export interface ReminderLook {
	/** `reminderId@seatId` for every reminder on a seat. */
	seen: Set<string>;
	/** The seat each reminder was on. */
	where: Record<ReminderId, SeatId>;
}

/**
 * The reminders on seats that weren't there at the last look (`before`), and the questions
 * they ask. With no last look (the board just opened), nothing asks.
 */
export function freshAsks(
	game: Game,
	characters: CharacterLookup,
	before: ReminderLook | undefined
): { asks: PromptAsk[]; dead: DeadAsk[]; look: ReminderLook } {
	const asks: PromptAsk[] = [];
	const dead: DeadAsk[] = [];
	const look: ReminderLook = { seen: new Set(), where: {} };
	for (const seatId of game.seating) {
		const seat = game.seats[seatId];
		for (const reminder of seat.reminders) {
			const key = `${reminder.reminderId}@${seatId}`;
			look.seen.add(key);
			look.where[reminder.reminderId] = seatId;
			if (!before || before.seen.has(key)) continue;
			if (reminderOwnerDead(game, reminder, characters))
				dead.push({ reminder, seatId, from: before.where[reminder.reminderId] });
			const characterId = reminder.like?.characterId ?? reminder.characterId;
			const prompt = reminderPrompt(reminderWords(reminder), characterId, characters);
			// The Fang Gu's "Dead" names the Fang Gu as the cause (Trevor, 2026-10-23).
			if (prompt && promptApplies(prompt, !!seat.dead))
				asks.push({
					seatId,
					prompt,
					cause: reminderDeathCause(game, characters, characterId)
				});
		}
	}
	return { asks, dead, look };
}

/** The dead seat a reminder belongs to, for the question's words. */
export function deadOwner(game: Game, reminder: ReminderInstance): SeatId | undefined {
	if (reminder.ownerSeatId && game.seats[reminder.ownerSeatId]) return reminder.ownerSeatId;
	return game.seating.find(
		(id) => game.seats[id].characterId === reminder.characterId && game.seats[id].dead
	);
}
