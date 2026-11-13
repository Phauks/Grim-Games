/**
 * The log entries in play: the first `cursor` of them, oldest first. Entries past the cursor
 * were undone and wait for Redo, so nothing that reads the game's history counts them.
 */
import type { LogEntry } from './log.ts';

export function appliedEntries(log: {
	readonly entries: readonly LogEntry[];
	readonly cursor: number;
}): readonly LogEntry[] {
	return log.entries.slice(0, log.cursor);
}
