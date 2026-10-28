/**
 * What Show to player keeps (the night info framework's "record on show"): showing a row of
 * Valid Information records it in the day log with `RecordNightInfo`, so the Mathematician's
 * "abnormal" and the game's history see it, and places the character's reminders the choice
 * calls for (the Washerwoman's "Townsfolk" and "Wrong") where they aren't already.
 */
import type { CharacterLookup, Game, Reminder, SeatId } from '#lib/core/model/index.ts';
import { infoRecord, type InfoChoice, type InfoPicker } from '#lib/core/rules/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { seatName } from '#lib/features/game/seat-label.ts';

/** The reminders a choice calls for that the board doesn't have yet. */
function missingReminders(
	game: Game,
	reminders: readonly { seatId: SeatId; reminder: Reminder }[]
): { seatId: SeatId; reminder: Reminder }[] {
	return reminders.filter(
		({ seatId, reminder }) =>
			!game.seats[seatId]?.reminders.some(
				(r) => r.characterId === reminder.characterId && r.label === reminder.label
			)
	);
}

/**
 * The commands for a choice shown to the waking player: its `RecordNightInfo`, or nothing
 * when the day log's latest record for that player and character already says the same. A
 * pair shown before its second player is known (the Washerwoman's "and any other player")
 * only places the shown player's reminder, as there is not yet anything whole to record.
 */
export function shownCommands(
	game: Game,
	characters: CharacterLookup,
	picker: InfoPicker,
	choice: InfoChoice
): Command[] {
	if (choice.seats.length < picker.seatCount) {
		const label = picker.reminders.target;
		const target = choice.seats[0];
		if (!label || target === undefined) return [];
		const reminder = { characterId: picker.characterId, label };
		return missingReminders(game, [{ seatId: target, reminder }]).map((r): Command => ({
			type: 'AddReminder',
			...r
		}));
	}
	const { text, reminders, abnormal } = infoRecord(
		picker,
		choice,
		{
			seat: (s) => seatName(game, s),
			character: (id) => characters.get(id)?.name ?? id
		},
		game,
		characters
	);
	const last = game.today.entries.findLast(
		(e) => e.kind === 'info' && e.seatId === picker.seatId && e.characterId === picker.characterId
	);
	if (last?.kind === 'info' && last.text === text) return [];
	const missing = missingReminders(game, reminders);
	return [
		{
			type: 'RecordNightInfo',
			seatId: picker.seatId,
			characterId: picker.characterId,
			text,
			...(missing.length > 0 ? { reminders: missing } : {}),
			...(abnormal ? { abnormal } : {})
		}
	];
}
