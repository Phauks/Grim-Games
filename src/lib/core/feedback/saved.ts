/**
 * Players' feedback on a finished game, as the Storyteller's device keeps it beside that game
 * (Trevor, 2026-10-25): the room forgets it when the game is reopened or a new one starts, so
 * the device saves each entry the room sends and shows it from there, offline too.
 */
import { parseFeedback, type GameFeedback } from './feedback.ts';

/** Bump with a migration in `parseSavedFeedback` when the saved shape changes. */
export const SAVED_FEEDBACK_VERSION = 1;

/** One player's feedback as saved: `id` is the room's, name and seat only when given. */
export interface SavedFeedbackEntry {
	id: string;
	feedback: GameFeedback;
	name?: string;
	seatId?: string;
}

export interface SavedGameFeedback {
	version: typeof SAVED_FEEDBACK_VERSION;
	/** In the order they first came. */
	entries: SavedFeedbackEntry[];
}

/** The longest player name kept; the room's names are shorter. */
const MAX_NAME_LENGTH = 100;

function parseEntry(raw: unknown): SavedFeedbackEntry | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const value = raw as Record<string, unknown>;
	if (typeof value.id !== 'string' || !value.id) return undefined;
	const feedback = parseFeedback(value.feedback);
	if (!feedback) return undefined;
	const entry: SavedFeedbackEntry = { id: value.id, feedback };
	// Anonymous feedback never carries who sent it, whatever arrived.
	if (feedback.anonymous) return entry;
	const name = typeof value.name === 'string' ? value.name.trim().slice(0, MAX_NAME_LENGTH) : '';
	if (name) entry.name = name;
	if (typeof value.seatId === 'string' && value.seatId) entry.seatId = value.seatId;
	return entry;
}

/** Entries from the room or storage, checked; repeats of an id keep the last. */
function parseEntries(raw: unknown): SavedFeedbackEntry[] {
	if (!Array.isArray(raw)) return [];
	return mergeFeedback([], raw);
}

/**
 * Saved feedback from storage, which an older or newer build may have written. Anything
 * unreadable gives none; there is no older version to migrate yet.
 */
export function parseSavedFeedback(raw: unknown): SavedFeedbackEntry[] {
	if (typeof raw !== 'object' || raw === null) return [];
	const value = raw as Record<string, unknown>;
	if (value.version !== SAVED_FEEDBACK_VERSION) return [];
	return parseEntries(value.entries);
}

export function savedFeedback(entries: readonly SavedFeedbackEntry[]): SavedGameFeedback {
	return { version: SAVED_FEEDBACK_VERSION, entries: [...entries] };
}

/**
 * Adds what the room sent to what is saved: an entry with a known id replaces it (the
 * player sent again), a new one goes at the end. Entries that aren't feedback are dropped.
 */
export function mergeFeedback(
	saved: readonly SavedFeedbackEntry[],
	incoming: readonly unknown[]
): SavedFeedbackEntry[] {
	const merged = [...saved];
	for (const raw of incoming) {
		const entry = parseEntry(raw);
		if (!entry) continue;
		const at = merged.findIndex((e) => e.id === entry.id);
		if (at === -1) merged.push(entry);
		else merged[at] = entry;
	}
	return merged;
}
