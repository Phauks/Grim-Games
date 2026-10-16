/**
 * The setup reminders tray on the board: core's suggestions (`setupReminders`) that are
 * still to place. A suggestion leaves the tray once a matching reminder (same character
 * and words) is on any seat, however it got there, or once the Storyteller dismisses it.
 * Nothing is placed automatically.
 */
import type { Game } from '#lib/core/model/index.ts';
import type { SetupReminder } from '#lib/core/rules/index.ts';

export interface TrayItem {
	/** Stable while the suggestions do not change: character, words and which copy. */
	key: string;
	suggestion: SetupReminder;
}

/** Suggestions with keys; a second copy of the same token gets `:1`, and so on. */
export function trayItems(suggestions: readonly SetupReminder[]): TrayItem[] {
	const seen = new Map<string, number>();
	return suggestions.map((suggestion) => {
		// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
		const base = `${suggestion.characterId}:${suggestion.label}`;
		const n = seen.get(base) ?? 0;
		seen.set(base, n + 1);
		return { key: `${base}:${n}`, suggestion };
	});
}

/** The items still to place: not dismissed, and more copies suggested than are placed. */
export function pendingTray(
	items: readonly TrayItem[],
	game: Game,
	dismissed: readonly string[]
): TrayItem[] {
	const placed = new Map<string, number>();
	for (const seatId of game.seating) {
		for (const r of game.seats[seatId].reminders) {
			// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
			const base = `${r.characterId}:${r.label}`;
			placed.set(base, (placed.get(base) ?? 0) + 1);
		}
	}
	return items.filter(({ key, suggestion }) => {
		if (dismissed.includes(key)) return false;
		// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
		const base = `${suggestion.characterId}:${suggestion.label}`;
		const left = placed.get(base) ?? 0;
		if (left > 0) {
			placed.set(base, left - 1);
			return false;
		}
		return true;
	});
}

/** The seats a suggestion fits, best first: the pre-filled seat, then the candidates. */
export function traySeats(suggestion: SetupReminder): string[] {
	const out = suggestion.seatId ? [suggestion.seatId] : [];
	for (const id of suggestion.candidates) if (!out.includes(id)) out.push(id);
	return out;
}

/** What the reminder bank under the board shows: setup suggestions, or every reminder left. */
export type BankView = 'setup' | 'all';
