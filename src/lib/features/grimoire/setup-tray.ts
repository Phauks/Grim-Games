/**
 * The setup reminders tray on the board: core's suggestions (`setupReminders`) that are
 * still to place. A suggestion leaves the tray once a matching reminder (same character
 * and words) is on any seat, however it got there, or once the Storyteller dismisses it.
 * Nothing is placed automatically.
 */
import type { SetupReminder } from '#lib/core/rules/index.ts';
import type { Reminder } from '#lib/core/model/index.ts';

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

/**
 * The items still to place: those not dismissed. Core already leaves out the tokens that
 * are on the board, so counting them off again here would hide a second copy as soon as
 * the first is placed (the No Dashii's two Poisoned).
 */
export function pendingTray(items: readonly TrayItem[], dismissed: readonly string[]): TrayItem[] {
	return items.filter(({ key }) => !dismissed.includes(key));
}

/**
 * Leaves out one suggestion for each matching reminder that is on the board but not on a
 * seat (loose, or held by a Fabled or Loric): core only counts seats, so without this a
 * Noble's "Know" put down loose stayed in the bank (Trevor, 2026-10-18).
 */
export function withoutOffSeat(
	items: readonly TrayItem[],
	offSeat: readonly Reminder[]
): TrayItem[] {
	const out = [...items];
	for (const r of offSeat) {
		const i = out.findLastIndex(
			(item) => item.suggestion.characterId === r.characterId && item.suggestion.label === r.label
		);
		if (i >= 0) out.splice(i, 1);
	}
	return out;
}

/** The seats a suggestion fits, best first: the pre-filled seat, then the candidates. */
export function traySeats(suggestion: SetupReminder): string[] {
	const out = suggestion.seatId ? [suggestion.seatId] : [];
	for (const id of suggestion.candidates) if (!out.includes(id)) out.push(id);
	return out;
}

/** What the reminder bank under the board shows: setup suggestions, or every reminder left. */
export type BankView = 'setup' | 'all';
