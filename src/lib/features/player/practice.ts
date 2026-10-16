/**
 * "Practice this script" (Trevor approved, 2026-10-16): flashcards of the script's
 * characters. The front is a character, the answer is TPI's ability text, nothing authored.
 * Progress is the set of characters the player marked as known, kept on the device.
 *
 * Saved progress carries `schemaVersion`: a newer build can open progress saved by an
 * older one (offline-first PWA), so `migratePractice` must read every version ever saved.
 */

export const PRACTICE_VERSION = 1;

export interface PracticeProgress {
	schemaVersion: typeof PRACTICE_VERSION;
	/** Characters marked "Knew it", by id. */
	known: string[];
}

export function emptyProgress(): PracticeProgress {
	return { schemaVersion: PRACTICE_VERSION, known: [] };
}

/** Reads saved progress; undefined for anything it cannot understand (a newer schema). */
export function migratePractice(raw: unknown): PracticeProgress | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const o = raw as Record<string, unknown>;
	if (o.schemaVersion !== 1 || !Array.isArray(o.known)) return undefined;
	return {
		schemaVersion: PRACTICE_VERSION,
		known: [...new Set(o.known.filter((x): x is string => typeof x === 'string'))]
	};
}

export function markKnown(progress: PracticeProgress, id: string): PracticeProgress {
	return progress.known.includes(id) ? progress : { ...progress, known: [...progress.known, id] };
}

/**
 * The next card: a random character not yet known, other than the one just shown when
 * another is left. Undefined when every character is known.
 */
export function nextCard(
	ids: readonly string[],
	progress: PracticeProgress,
	current?: string,
	random: () => number = Math.random
): string | undefined {
	const left = ids.filter((id) => !progress.known.includes(id));
	const pool = left.length > 1 ? left.filter((id) => id !== current) : left;
	if (pool.length === 0) return undefined;
	return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
