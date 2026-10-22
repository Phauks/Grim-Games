/**
 * The changelog, filled from the repository's history at build time (build-info.ts) instead
 * of by hand: every merged PR, newest first, by the day it merged. Releases come from git tags
 * (`v0.5.0`), so until the first one everything is Unreleased. This replaces the Keep a
 * Changelog page that was to stay empty until 1.0 (2026-10-15).
 */
import type { BuildCommit, Changes } from './update-notes.ts';

/** One line of the changelog: a merged PR (or a commit straight on the branch). */
export interface Change extends BuildCommit {
	/** The UTC day it landed, YYYY-MM-DD. */
	date: string;
	/** The oldest release whose tag contains it, such as '0.5.0'; absent while unreleased. */
	release?: string;
}

export interface ChangeHistory {
	/** Newest first. */
	changes: Change[];
	/** False when the build's clone stopped short of the first commit, so older ones are missing. */
	complete: boolean;
}

export interface ChangelogDay {
	date: string;
	changes: Changes;
}

export interface ChangelogRelease {
	/** e.g. '0.5.0'; `null` for changes not yet released. */
	version: string | null;
	/** The day of its newest change. */
	date: string;
	count: number;
	days: ChangelogDay[];
}

/**
 * The history in the page's order: a block per release (Unreleased first), and in each a list
 * per day. Only the very last list is marked incomplete when the history stops short.
 */
export function changelogReleases(history: ChangeHistory): ChangelogRelease[] {
	const releases: ChangelogRelease[] = [];
	for (const change of history.changes) {
		const version = change.release ?? null;
		let release = releases.at(-1);
		if (!release || release.version !== version) {
			release = { version, date: change.date, count: 0, days: [] };
			releases.push(release);
		}
		let day = release.days.at(-1);
		if (!day || day.date !== change.date) {
			day = { date: change.date, changes: { commits: [], complete: true } };
			release.days.push(day);
		}
		const { sha, subject, pr, commits } = change;
		day.changes.commits.push({
			sha,
			subject,
			...(pr === undefined ? {} : { pr }),
			...(commits === undefined ? {} : { commits })
		});
		release.count++;
	}
	const last = releases.at(-1)?.days.at(-1);
	if (last && !history.complete) last.changes.complete = false;
	return releases;
}

/** Filled in by Vite at build time (`define` in vite.config.ts, from build-info.ts). */
export const changeHistory: ChangeHistory = __CHANGE_HISTORY__;
