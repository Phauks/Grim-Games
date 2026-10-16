/**
 * What changed between the running build and the one waiting to replace it, for the update
 * prompt (Trevor, 2026-10-16: "open a dropdown to see changes"). Each build publishes its
 * recent commit subjects as `/build-notes.json` (vite.config.ts); the prompt fetches the new
 * build's file and lists the commits it has that the running build does not.
 */

/** Where every build publishes its notes. Fetched past the service worker's cache. */
export const BUILD_NOTES_PATH = '/build-notes.json';

export interface BuildCommit {
	sha: string;
	subject: string;
}

export interface BuildNotes {
	/** The full commit the build was made from. */
	commit: string;
	/** Recent commits, newest first, ending at `commit`'s ancestors as far as the log reaches. */
	commits: BuildCommit[];
}

export interface Changes {
	commits: BuildCommit[];
	/** False when the running build is older than the notes reach, so the list is cut short. */
	complete: boolean;
}

/** Reads `/build-notes.json`, dropping anything malformed. */
export function parseBuildNotes(input: unknown): BuildNotes | null {
	if (!input || typeof input !== 'object') return null;
	const { commit, commits } = input as Record<string, unknown>;
	if (typeof commit !== 'string' || !Array.isArray(commits)) return null;
	return {
		commit,
		commits: commits.filter(
			(c): c is BuildCommit =>
				!!c &&
				typeof (c as BuildCommit).sha === 'string' &&
				typeof (c as BuildCommit).subject === 'string'
		)
	};
}

/** The commits in `notes` that came after `running`, newest first. */
export function changesSince(notes: BuildNotes, running: string): Changes {
	const at = notes.commits.findIndex((c) => c.sha === running);
	if (at === -1) return { commits: notes.commits, complete: false };
	return { commits: notes.commits.slice(0, at), complete: true };
}
