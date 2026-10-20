/**
 * What changed between the running build and the one waiting to replace it, for the update
 * prompt (Trevor, 2026-10-16: "open a dropdown to see changes"). Each build publishes its
 * recent commit subjects as `/build-notes.json` (vite.config.ts); the prompt fetches the new
 * build's file and lists the commits it has that the running build does not.
 *
 * Cloudflare's build checks out only the newest commit, so its notes may not reach back to the
 * running build. Then the prompt asks GitHub's compare API (the repository is public) for the
 * commits between the two builds.
 */

/** Where every build publishes its notes. Fetched past the service worker's cache. */
export const BUILD_NOTES_PATH = '/build-notes.json';

export interface BuildCommit {
	sha: string;
	subject: string;
	/** The pull request this merge commit landed; `subject` is then the PR's title. */
	pr?: number;
}

/**
 * One line of the list for a commit on the branch's own history, or null for a commit that
 * says nothing new (Trevor, 2026-10-20: the list was full of merge lines). A PR lands as
 * "Merge pull request #N from …" with the PR's title as its body, so it shows as that title.
 * Merging the base branch into a working branch ("Merge remote-tracking branch …",
 * "Merge branch …") repeats changes listed elsewhere, so it is dropped.
 */
export function noteFor(sha: string, message: string): BuildCommit | null {
	const [subject = '', ...body] = message.split('\n');
	const pr = /^Merge pull request #(\d+) /.exec(subject);
	if (pr) {
		const title = body.find((line) => line.trim())?.trim();
		return { sha, subject: title ?? subject, pr: Number(pr[1]) };
	}
	if (/^Merge (remote-tracking )?branch /.test(subject)) return null;
	return { sha, subject };
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
		commits: commits
			.filter(
				(c): c is BuildCommit =>
					!!c &&
					typeof (c as BuildCommit).sha === 'string' &&
					typeof (c as BuildCommit).subject === 'string'
			)
			.map(({ sha, subject, pr }) =>
				typeof pr === 'number' ? { sha, subject, pr } : { sha, subject }
			)
	};
}

/** GitHub's compare API for the public repository (docs.github.com/rest/commits/commits). */
export function compareUrl(running: string, next: string): string {
	return `https://api.github.com/repos/Phauks/Grim-Games/compare/${running}...${next}`;
}

/**
 * Reads a compare response: `commits` oldest first (at most 250 per page), each with its
 * `parents`, and `total_commits`. Follows first parents back from the newest commit, so the
 * list is the branch's own history (one line per merged PR) rather than every commit inside
 * each PR. Returns it newest first, marked incomplete when GitHub left some out.
 */
export function parseCompare(input: unknown): Changes | null {
	if (!input || typeof input !== 'object') return null;
	const { commits, total_commits: total } = input as Record<string, unknown>;
	if (!Array.isArray(commits) || typeof total !== 'number') return null;
	const bySha = new Map<string, { message: string; parent?: string }>();
	for (const entry of commits) {
		const sha = (entry as { sha?: unknown })?.sha;
		const message = (entry as { commit?: { message?: unknown } })?.commit?.message;
		if (typeof sha !== 'string' || typeof message !== 'string') return null;
		const parents = (entry as { parents?: { sha?: unknown }[] }).parents;
		const parent = Array.isArray(parents) ? parents[0]?.sha : undefined;
		bySha.set(sha, { message, parent: typeof parent === 'string' ? parent : undefined });
	}
	const list: BuildCommit[] = [];
	let sha = (commits.at(-1) as { sha?: string } | undefined)?.sha;
	for (let entry = sha && bySha.get(sha); sha && entry; entry = sha && bySha.get(sha)) {
		const note = noteFor(sha, entry.message);
		if (note) list.push(note);
		bySha.delete(sha);
		sha = entry.parent;
	}
	return { commits: list, complete: total <= commits.length };
}

/** The commits in `notes` that came after `running`, newest first. */
export function changesSince(notes: BuildNotes, running: string): Changes {
	const at = notes.commits.findIndex((c) => c.sha === running);
	if (at === -1) return { commits: notes.commits, complete: false };
	return { commits: notes.commits.slice(0, at), complete: true };
}
